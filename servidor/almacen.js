// servidor/almacen.js · Almacenamiento seguro en archivos JSON y bitácoras JSONL
import fs from "node:fs/promises";
import path from "node:path";

const DIR_DATOS = path.resolve(import.meta.dirname, "../datos");
const DIR_RESPALDOS = path.join(DIR_DATOS, "respaldos");
const DIR_CONFIG = path.join(DIR_DATOS, "config");

const colas = new Map();
let ultimoDiaRespaldado = null;

// Valida nombres: minúsculas, números y guiones, con subcarpeta opcional (ej: mensajes/con_000001)
export function validarColeccion(col) {
  if (typeof col !== "string") {
    const err = new Error("Nombre de colección inválido");
    err.estado = 400;
    throw err;
  }
  const regex = /^[a-z0-9-]+(?:\/[a-z0-9_-]+)?$/;
  if (!regex.test(col) || col.includes("..")) {
    const err = new Error(`Nombre de colección inválido: ${col}`);
    err.estado = 400;
    throw err;
  }
}

function rutaColeccion(col) {
  validarColeccion(col);
  return path.join(DIR_DATOS, `${col}.json`);
}

// Encola escrituras concurrentes por archivo
function encolarEscritura(ruta, operacion) {
  const previa = colas.get(ruta) || Promise.resolve();
  const siguiente = previa
    .catch(() => {})
    .then(operacion);

  colas.set(
    ruta,
    siguiente.finally(() => {
      if (colas.get(ruta) === siguiente) {
        colas.delete(ruta);
      }
    })
  );
  return siguiente;
}

// Escritura atómica a archivo temporal y rename
async function escribirArchivoAtomico(ruta, contenido) {
  const dir = path.dirname(ruta);
  await fs.mkdir(dir, { recursive: true });
  const rutaTmp = `${ruta}.${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await fs.writeFile(rutaTmp, contenido, "utf8");
    await fs.rename(rutaTmp, ruta);
  } catch (err) {
    try {
      await fs.unlink(rutaTmp);
    } catch {}
    throw err;
  }
}

// Respaldo diario en la primera escritura del día; conserva los 14 más recientes
async function asegurarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (ultimoDiaRespaldado === hoy) return;

  const destinoHoy = path.join(DIR_RESPALDOS, hoy);
  try {
    await fs.access(destinoHoy);
    ultimoDiaRespaldado = hoy;
    return;
  } catch {
    // Si no existe la carpeta de hoy, se procede a crear el respaldo
  }

  try {
    await fs.mkdir(destinoHoy, { recursive: true });

    // Copiar cada elemento de datos/ excepto la carpeta respaldos/
    const entradasDatos = await fs.readdir(DIR_DATOS, { withFileTypes: true });
    for (const ent of entradasDatos) {
      if (ent.name === "respaldos") continue;
      const origen = path.join(DIR_DATOS, ent.name);
      const destino = path.join(destinoHoy, ent.name);
      await fs.cp(origen, destino, { recursive: true });
    }

    // Limpieza: conservar únicamente los 14 respaldos más recientes
    const entradasRespaldos = await fs.readdir(DIR_RESPALDOS, { withFileTypes: true });
    const carpetas = entradasRespaldos
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort();

    if (carpetas.length > 14) {
      const eliminar = carpetas.slice(0, carpetas.length - 14);
      for (const carpeta of eliminar) {
        await fs.rm(path.join(DIR_RESPALDOS, carpeta), { recursive: true, force: true });
      }
    }

    ultimoDiaRespaldado = hoy;
  } catch (err) {
    console.error("Error al generar respaldo diario:", err);
  }
}

// Leer colección (si no existe retorna [])
export async function leer(col) {
  const ruta = rutaColeccion(col);
  try {
    const raw = await fs.readFile(ruta, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

// Escribir lista completa en la colección
export async function escribir(col, lista) {
  const ruta = rutaColeccion(col);
  await asegurarRespaldoDiario();
  return encolarEscritura(ruta, async () => {
    const json = JSON.stringify(lista, null, 2);
    await escribirArchivoAtomico(ruta, json);
    return lista;
  });
}

// Agregar registro asignando id (3 letras + _ + 6 dígitos) y fecha ISO
export async function agregar(col, reg) {
  const lista = await leer(col);

  // Prefijo: 3 primeras letras de la colección
  const parteBase = col.includes("/") ? col.split("/")[0] : col;
  const letras = parteBase.replace(/[^a-z]/g, "").slice(0, 3);
  const prefijo = (letras || "reg").padEnd(3, "x");

  // Mayor número existente + 1
  let maxNum = 0;
  for (const item of lista) {
    if (typeof item?.id === "string") {
      const match = item.id.match(/_(\d{1,})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const siguiente = String(maxNum + 1).padStart(6, "0");
  const nuevo = {
    ...reg,
    id: `${prefijo}_${siguiente}`,
    fecha: new Date().toISOString()
  };

  lista.push(nuevo);
  await escribir(col, lista);
  return nuevo;
}

// Actualizar registro fusionando campos
export async function actualizar(col, id, cambios) {
  const lista = await leer(col);
  const indice = lista.findIndex((item) => item.id === id);
  if (indice === -1) {
    const err = new Error(`Registro no encontrado: ${id}`);
    err.estado = 404;
    throw err;
  }

  const anterior = lista[indice];
  const { id: _id, fecha: _fecha, ...modificaciones } = cambios || {};
  const actualizado = {
    ...anterior,
    ...modificaciones,
    id: anterior.id,
    fecha: anterior.fecha
  };

  lista[indice] = actualizado;
  await escribir(col, lista);
  return actualizado;
}

// Eliminar registro por id
export async function eliminar(col, id) {
  const lista = await leer(col);
  const indice = lista.findIndex((item) => item.id === id);
  if (indice === -1) {
    const err = new Error(`Registro no encontrado: ${id}`);
    err.estado = 404;
    throw err;
  }

  const [eliminado] = lista.splice(indice, 1);
  await escribir(col, lista);
  return eliminado;
}

// Buscar registros con filtros exactos
export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  const entradas = Object.entries(filtro || {});
  if (entradas.length === 0) return lista;

  return lista.filter((item) => {
    return entradas.every(([clave, valor]) => String(item[clave]) === String(valor));
  });
}

// Anexar línea a archivo .jsonl
export async function anexarLinea(archivo, obj) {
  const nombre = archivo.endsWith(".jsonl") ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DIR_DATOS, nombre);
  await asegurarRespaldoDiario();

  return encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + "\n";
    await fs.appendFile(ruta, linea, "utf8");
    return obj;
  });
}

// Leer todas las líneas de un archivo .jsonl
export async function leerLineas(archivo) {
  const nombre = archivo.endsWith(".jsonl") ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DIR_DATOS, nombre);
  try {
    const raw = await fs.readFile(ruta, "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

// Leer archivo de configuración JSON en datos/config/
export async function leerConfig(nombre) {
  const sinExt = nombre.endsWith(".json") ? nombre.slice(0, -5) : nombre;
  const ruta = path.join(DIR_CONFIG, `${sinExt}.json`);
  try {
    const raw = await fs.readFile(ruta, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

// Escribir archivo de configuración JSON en datos/config/
export async function escribirConfig(nombre, obj) {
  const sinExt = nombre.endsWith(".json") ? nombre.slice(0, -5) : nombre;
  const ruta = path.join(DIR_CONFIG, `${sinExt}.json`);
  return encolarEscritura(ruta, async () => {
    await escribirArchivoAtomico(ruta, JSON.stringify(obj, null, 2));
    return obj;
  });
}

