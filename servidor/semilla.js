// servidor/semilla.js · Carga de datos de prueba desde datos/semilla/ a datos/
import readline from "node:readline/promises";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import * as almacen from "./almacen.js";

const CLAVE_SEMILLA = "Demo12345";
const DIR_SEMILLA = path.resolve(import.meta.dirname, "../datos/semilla");
const DIR_DATOS = path.resolve(import.meta.dirname, "../datos");

async function archivoExiste(ruta) {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const forzar = process.argv.includes("--forzar") || process.argv.includes("-f");

  console.log("=== Semilla de Datos del Ecosistema Educativo ===");

  if (forzar) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const respuesta = await rl.question(
      "ADVERTENCIA: --forzar sobrescribirá las colecciones existentes con los datos de la semilla.\n¿Deseas continuar? (s/N): "
    );
    rl.close();

    if (!/^s(i)?$/i.test(respuesta.trim())) {
      console.log("Operación cancelada por el usuario.");
      process.exit(0);
    }
  }

  const entradas = await fs.readdir(DIR_SEMILLA);
  const archivos = entradas.filter((f) => f.endsWith(".json")).sort();

  if (archivos.length === 0) {
    console.log("No se encontraron archivos en datos/semilla/.");
    return;
  }

  // Precalcular hash para usuarios
  let claveHashCalculada = null;

  for (const archivo of archivos) {
    const col = path.basename(archivo, ".json");
    const rutaDestino = path.join(DIR_DATOS, archivo);
    const existe = await archivoExiste(rutaDestino);

    if (existe && !forzar) {
      console.log(`[OMITIDO] Colección "${col}" ya existe en datos/ (usa --forzar para sobrescribir).`);
      continue;
    }

    const contenidoRaw = await fs.readFile(path.join(DIR_SEMILLA, archivo), "utf8");
    let registros = JSON.parse(contenidoRaw);

    // Al copiar usuarios se genera claveHash de "Demo12345" para todos
    if (col === "usuarios") {
      if (!claveHashCalculada) {
        claveHashCalculada = await bcrypt.hash(CLAVE_SEMILLA, 10);
      }
      registros = registros.map((u) => ({
        ...u,
        claveHash: claveHashCalculada
      }));
    }

    await almacen.escribir(col, registros);
    console.log(`[INSTALADO] Colección "${col}": ${registros.length} registros cargados.`);
  }

  console.log("\nProceso de carga de semilla completado con éxito.");
  if (claveHashCalculada) {
    console.log(`Contraseña para todos los usuarios semilla: "${CLAVE_SEMILLA}"`);
  }
}

main().catch((err) => {
  console.error("Error al ejecutar la semilla:", err);
  process.exit(1);
});
