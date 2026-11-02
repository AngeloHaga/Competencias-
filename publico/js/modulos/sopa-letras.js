// publico/js/modulos/sopa-letras.js · Juego interactivo Sopa de Letras
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({ titulo: "Sopa de Letras", roles: ["estudiante", "docente"] });

const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

// Direcciones según dificultad
const DIRS_BASE = [
  { dx: 1, dy: 0 },  // Horizontal derecha
  { dx: 0, dy: 1 }   // Vertical abajo
];

const DIRS_DIAG = [
  ...DIRS_BASE,
  { dx: 1, dy: 1 },  // Diagonal abajo derecha
  { dx: 1, dy: -1 }  // Diagonal arriba derecha
];

const DIRS_TODAS = [
  ...DIRS_DIAG,
  { dx: -1, dy: 0 }, // Horizontal izquierda
  { dx: 0, dy: -1 }, // Vertical arriba
  { dx: -1, dy: 1 }, // Diagonal abajo izquierda
  { dx: -1, dy: -1 } // Diagonal arriba izquierda
];

/**
 * Función pura exportada: genera la grilla con palabras de la más larga a la más corta
 * con hasta 200 intentos por palabra, permitiendo cruces y rellenando con letras aleatorias.
 * @param {Array<string|Object>} palabras - Lista de palabras (o items con .palabra)
 * @param {number} tamano - Tamaño N de la cuadrícula N×N
 * @param {Array<{dx: number, dy: number}>} direcciones - Vector de direcciones permitidas
 * @returns {{ grilla: Array<Array<string>>, ubicaciones: Array<{ palabra: string, celdas: Array<{fila: number, col: number}> }> }}
 */
export function generarSopa(palabras, tamano, direcciones = DIRS_BASE) {
  // Inicializar matriz tamano × tamano vacía
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(""));
  const ubicaciones = [];

  // Extraer string normalizado y ordenar de más larga a más corta
  const listaNormalizada = palabras
    .map((p) => {
      const texto = typeof p === "string" ? p : (p.termino || p.palabra || "");
      const norm = util.normalizar(texto).replace(/[^A-ZÑ]/g, "");
      return { textoOriginal: texto, normalizada: norm, objeto: p };
    })
    .filter((item) => item.normalizada.length >= 3 && item.normalizada.length <= tamano)
    .sort((a, b) => b.normalizada.length - a.normalizada.length);

  for (const item of listaNormalizada) {
    const palabra = item.normalizada;
    let colocada = false;

    // Hasta 200 intentos por palabra
    for (let intento = 0; intento < 200; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const len = palabra.length;

      // Calcular límites de inicio válidos para que quepa en la grilla
      const minFila = dir.dy < 0 ? len - 1 : 0;
      const maxFila = dir.dy > 0 ? tamano - len : tamano - 1;
      const minCol = dir.dx < 0 ? len - 1 : 0;
      const maxCol = dir.dx > 0 ? tamano - len : tamano - 1;

      if (minFila > maxFila || minCol > maxCol) continue;

      const fInicio = Math.floor(Math.random() * (maxFila - minFila + 1)) + minFila;
      const cInicio = Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol;

      // Verificar si cabe y cruza con letras iguales
      let esValido = true;
      const celdasTemp = [];

      for (let k = 0; k < len; k++) {
        const f = fInicio + k * dir.dy;
        const c = cInicio + k * dir.dx;
        const letraActual = grilla[f][c];
        const letraPalabra = palabra[k];

        if (letraActual !== "" && letraActual !== letraPalabra) {
          esValido = false;
          break;
        }
        celdasTemp.push({ fila: f, col: c });
      }

      if (esValido) {
        // Escribir en la grilla
        for (let k = 0; k < len; k++) {
          const { fila, col } = celdasTemp[k];
          grilla[fila][col] = palabra[k];
        }

        ubicaciones.push({
          palabra,
          textoOriginal: item.textoOriginal,
          objeto: item.objeto,
          celdas: celdasTemp
        });

        colocada = true;
        break;
      }
    }
    // Si no cupo tras 200 intentos, se descarta esa palabra
  }

  // Rellenar espacios vacíos con letras aleatorias A-Z y Ñ
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[f][c] === "") {
        grilla[f][c] = ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

// Elementos DOM
const enlaceTemaCabecera = document.getElementById("enlaceTemaCabecera");
const selectDificultad = document.getElementById("selectDificultad");
const statPalabras = document.getElementById("statPalabras");
const statTiempo = document.getElementById("statTiempo");
const btnRendirse = document.getElementById("btnRendirse");
const btnGenerarIA = document.getElementById("btnGenerarIA");
const btnReiniciar = document.getElementById("btnReiniciar");
const estadoVacio = document.getElementById("estadoVacio");
const enlaceTemaVacio = document.getElementById("enlaceTemaVacio");
const contenedorRetroSopa = document.getElementById("contenedorRetroSopa");
const grillaSopa = document.getElementById("grillaSopa");
const listaPalabras = document.getElementById("listaPalabras");
const areaJuego = document.getElementById("areaJuego");

// Estado del módulo
let temaActual = null;
let glosarioTema = [];
let grillaActual = [];
let ubicacionesActuales = [];
let palabrasEncontradas = new Set();
let juegoTerminado = false;
let tiempoSegundos = 0;
let intervaloTiempo = null;

// Control de selección por Pointer Events
let seleccionando = false;
let celdaInicio = null;
let celdasSeleccionadas = [];

/**
 * Inicializa la actividad
 */
async function inicializar() {
  ui.cargando(true);
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    const enlaceTemaUrl = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;
    enlaceTemaCabecera.textContent = temaActual.titulo || "Tema";
    enlaceTemaCabecera.href = enlaceTemaUrl;
    enlaceTemaVacio.href = enlaceTemaUrl;

    const glosario = await api.listar("glosario", { temaId: temaActual.id });

    // Filtrar términos de una sola palabra normalizada (sin espacios ni guiones) con longitud >= 3
    glosarioTema = glosario.filter((item) => {
      const terminoLimpio = String(item.termino || "").trim();
      const norm = util.normalizar(terminoLimpio);
      return !terminoLimpio.includes(" ") && norm.length >= 3 && /^[A-ZÑ]+$/.test(norm);
    });

    if (glosarioTema.length < 3) {
      areaJuego.style.display = "none";
      btnRendirse.style.display = "none";
      btnReiniciar.style.display = "none";
      estadoVacio.style.display = "flex";
      return;
    }

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la sopa de letras", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Obtiene parámetros de tamaño y cantidad según la dificultad actual
 */
function obtenerParametrosDificultad() {
  const dif = selectDificultad.value;
  if (dif === "facil") {
    return { tamano: 10, cantPalabras: 8, dirs: DIRS_BASE };
  } else if (dif === "dificil") {
    return { tamano: 15, cantPalabras: 12, dirs: DIRS_TODAS };
  }
  return { tamano: 12, cantPalabras: 10, dirs: DIRS_DIAG };
}

/**
 * Genera nuevas palabras con IA conectadas al contenido curricular del tema
 */
async function generarNuevasPalabrasConIA() {
  if (!temaActual) return;
  ui.cargando(true);
  try {
    const { cantPalabras, tamano } = obtenerParametrosDificultad();
    const nuevas = await api.ia("generar-palabras-sopa", {
      temaId: temaActual.id,
      cantidad: cantPalabras + 4,
      tamanoMaximo: tamano
    });

    if (Array.isArray(nuevas) && nuevas.length > 0) {
      // Filtrar y normalizar términos generados
      const limpias = nuevas.filter((item) => {
        const terminoLimpio = String(item.termino || "").trim();
        const norm = util.normalizar(terminoLimpio);
        return !terminoLimpio.includes(" ") && norm.length >= 3 && norm.length <= tamano && /^[A-ZÑ]+$/.test(norm);
      });

      if (limpias.length >= 3) {
        // Enriquecer el catálogo de términos del tema con las nuevas palabras generadas
        const mapaExistentes = new Map(glosarioTema.map((g) => [util.normalizar(g.termino), g]));
        limpias.forEach((item) => {
          const clave = util.normalizar(item.termino);
          if (!mapaExistentes.has(clave)) {
            glosarioTema.push(item);
          }
        });

        ui.aviso(`✨ Se generaron ${limpias.length} nuevos términos con IA sobre el contenido`, "exito");
        iniciarPartida(limpias);
        return;
      }
    }
    ui.aviso("La IA no devolvió suficientes términos nuevos, usando términos del contenido", "advertencia");
    iniciarPartida();
  } catch (err) {
    ui.aviso(`No se pudo conectar con la IA (${err.message}). Usando palabras del contenido curricular.`, "advertencia");
    iniciarPartida();
  } finally {
    ui.cargando(false);
  }
}

/**
 * Configura e inicia la sopa según la dificultad elegida
 * @param {Array} [palabrasEspecificas] - Lista opcional de palabras prioritarias (ej. generadas con IA)
 */
function iniciarPartida(palabrasEspecificas = null) {
  detenerTemporizador();
  tiempoSegundos = 0;
  juegoTerminado = false;
  palabrasEncontradas.clear();
  celdasSeleccionadas = [];
  seleccionando = false;
  celdaInicio = null;
  contenedorRetroSopa.innerHTML = "";
  btnRendirse.disabled = false;

  const { tamano, cantPalabras, dirs } = obtenerParametrosDificultad();

  // Fuente de palabras: prioritarias o catálogo disponible
  const fuente = Array.isArray(palabrasEspecificas) && palabrasEspecificas.length >= 3
    ? palabrasEspecificas
    : glosarioTema;

  // Filtrar palabras que no excedan el tamaño de la cuadrícula y barajar
  const palabrasCandidatas = util
    .barajar(fuente)
    .filter((g) => util.normalizar(g.termino).length <= tamano)
    .slice(0, cantPalabras);

  const resultado = generarSopa(palabrasCandidatas, tamano, dirs);
  grillaActual = resultado.grilla;
  ubicacionesActuales = resultado.ubicaciones;

  actualizarIndicadores();
  renderizarGrilla(tamano);
  renderizarListaPalabras();
  iniciarTemporizador();
}

/**
 * Renderiza visualmente la cuadrícula de letras y asocia Pointer Events
 * @param {number} tamano
 */
function renderizarGrilla(tamano) {
  grillaSopa.innerHTML = "";
  grillaSopa.style.gridTemplateColumns = `repeat(${tamano}, 1fr)`;

  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      const letra = grillaActual[f][c];
      const div = document.createElement("div");
      div.className = "celda-sopa";
      div.dataset.fila = String(f);
      div.dataset.col = String(c);
      div.textContent = letra;
      grillaSopa.appendChild(div);
    }
  }
}

/**
 * Renderiza la lista lateral de palabras a buscar
 */
function renderizarListaPalabras() {
  listaPalabras.innerHTML = "";

  ubicacionesActuales.forEach((ub) => {
    const li = document.createElement("li");
    li.className = "sopa-palabra-item";
    li.id = `palabra-item-${ub.palabra}`;
    li.innerHTML = `
      <span>${ui.escapar(ub.textoOriginal)}</span>
      <span class="sopa-palabra-item__badge">${ub.palabra.length} letras</span>
    `;
    listaPalabras.appendChild(li);
  });
}

/**
 * Eventos Pointer Events en la grilla para selección en línea recta
 */
grillaSopa.addEventListener("pointerdown", (e) => {
  if (juegoTerminado) return;
  const celda = e.target.closest(".celda-sopa");
  if (!celda) return;

  e.preventDefault();
  grillaSopa.setPointerCapture(e.pointerId);
  seleccionando = true;
  celdaInicio = {
    fila: parseInt(celda.dataset.fila, 10),
    col: parseInt(celda.dataset.col, 10)
  };
  actualizarSeleccion(celdaInicio);
});

grillaSopa.addEventListener("pointermove", (e) => {
  if (!seleccionando || !celdaInicio || juegoTerminado) return;
  e.preventDefault();

  // Encontrar el elemento bajo las coordenadas del puntero
  const elementoDebajo = document.elementFromPoint(e.clientX, e.clientY);
  const celda = elementoDebajo?.closest(".celda-sopa");
  if (!celda) return;

  const celdaActual = {
    fila: parseInt(celda.dataset.fila, 10),
    col: parseInt(celda.dataset.col, 10)
  };

  actualizarSeleccion(celdaActual);
});

async function finalizarSeleccion(e) {
  if (!seleccionando) return;
  seleccionando = false;
  if (e && grillaSopa.hasPointerCapture(e.pointerId)) {
    grillaSopa.releasePointerCapture(e.pointerId);
  }

  // Verificar si la palabra seleccionada coincide en cualquier sentido
  const palabraSeleccionada = celdasSeleccionadas
    .map(({ fila, col }) => grillaActual[fila][col])
    .join("");

  const palabraInvertida = [...palabraSeleccionada].reverse().join("");

  // Buscar coincidencia en ubicaciones pendientes
  const coincidencia = ubicacionesActuales.find(
    (ub) =>
      !palabrasEncontradas.has(ub.palabra) &&
      (ub.palabra === palabraSeleccionada || ub.palabra === palabraInvertida)
  );

  if (coincidencia) {
    palabrasEncontradas.add(coincidencia.palabra);

    // Marcar celdas como acertadas fijas
    coincidencia.celdas.forEach(({ fila, col }) => {
      const el = obtenerElementoCelda(fila, col);
      if (el) {
        el.classList.add("acertada");
      }
    });

    // Tachar en la lista lateral
    const li = document.getElementById(`palabra-item-${coincidencia.palabra}`);
    if (li) {
      li.classList.add("encontrada");
      li.querySelector(".sopa-palabra-item__badge").textContent = "✓ Encontrada";
    }

    // Mostrar retroalimentación con la definición del término
    const def = coincidencia.objeto?.definicion || coincidencia.objeto?.resumen || "";
    const panel = mostrarRetro({
      correcto: true,
      explicacion: `<strong>${coincidencia.textoOriginal}:</strong> ${def}`,
      sugerencia: coincidencia.objeto?.retroalimentacion || ""
    });
    contenedorRetroSopa.innerHTML = "";
    contenedorRetroSopa.appendChild(panel);

    actualizarIndicadores();

    // Comprobar si completó todas las palabras
    if (palabrasEncontradas.size === ubicacionesActuales.length) {
      finalizarPartida(true);
    }
  }

  limpiarResaltadoSeleccion();
  celdaInicio = null;
  celdasSeleccionadas = [];
}

grillaSopa.addEventListener("pointerup", finalizarSeleccion);
grillaSopa.addEventListener("pointercancel", finalizarSeleccion);

/**
 * Calcula la línea recta entre celdaInicio y celdaActual y actualiza el resaltado
 * @param {{fila: number, col: number}} celdaActual
 */
function actualizarSeleccion(celdaActual) {
  limpiarResaltadoSeleccion();

  const df = celdaActual.fila - celdaInicio.fila;
  const dc = celdaActual.col - celdaInicio.col;

  // Determinar dirección de línea recta (horizontal, vertical o diagonal 45°)
  const pasoF = df === 0 ? 0 : df / Math.abs(df);
  const pasoC = dc === 0 ? 0 : dc / Math.abs(dc);

  const esHorizontal = df === 0;
  const esVertical = dc === 0;
  const esDiagonal = Math.abs(df) === Math.abs(dc);

  if (!esHorizontal && !esVertical && !esDiagonal) {
    // Si no es línea recta pura, resaltar únicamente la celda inicial
    celdasSeleccionadas = [celdaInicio];
  } else {
    const distancia = Math.max(Math.abs(df), Math.abs(dc));
    celdasSeleccionadas = [];
    for (let i = 0; i <= distancia; i++) {
      celdasSeleccionadas.push({
        fila: celdaInicio.fila + i * pasoF,
        col: celdaInicio.col + i * pasoC
      });
    }
  }

  // Aplicar clase resaltadora
  celdasSeleccionadas.forEach(({ fila, col }) => {
    const el = obtenerElementoCelda(fila, col);
    if (el) el.classList.add("seleccionando");
  });
}

function limpiarResaltadoSeleccion() {
  grillaSopa.querySelectorAll(".celda-sopa.seleccionando").forEach((el) => {
    el.classList.remove("seleccionando");
  });
}

function obtenerElementoCelda(fila, col) {
  return grillaSopa.querySelector(`.celda-sopa[data-fila="${fila}"][data-col="${col}"]`);
}

/**
 * Finaliza la partida, registra intento y muestra resumen formativo
 * @param {boolean} victoria
 */
async function finalizarPartida(victoria = false) {
  juegoTerminado = true;
  detenerTemporizador();
  btnRendirse.disabled = true;

  const total = ubicacionesActuales.length;
  const encontradas = palabrasEncontradas.size;
  const errores = total - encontradas;
  const duracionSeg = Math.max(1, tiempoSegundos);
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  try {
    await registrarIntento({
      actividad: "sopa-letras",
      temaId: temaActual.id,
      puntaje: encontradas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch {
    // Silencioso en caso de error de conexión
  }

  const accion = await mostrarResumen({
    titulo: victoria ? "¡Excelente! Completaste la sopa de letras" : "Partida Finalizada",
    aciertos: encontradas,
    errores,
    recomendaciones: errores > 0 ? ["Revisa los términos del tema para memorizar su ortografía."] : [],
    enlaceTema
  });

  if (accion === "repetir") {
    generarNuevasPalabrasConIA();
  }
}

/**
 * Botón Rendirse: revela las palabras restantes en la grilla y en la lista
 */
btnRendirse.addEventListener("click", () => {
  if (juegoTerminado) return;

  ubicacionesActuales.forEach((ub) => {
    if (!palabrasEncontradas.has(ub.palabra)) {
      // Marcar visualmente las celdas no encontradas con estilo revelado
      ub.celdas.forEach(({ fila, col }) => {
        const el = obtenerElementoCelda(fila, col);
        if (el && !el.classList.contains("acertada")) {
          el.classList.add("revelada");
        }
      });

      const li = document.getElementById(`palabra-item-${ub.palabra}`);
      if (li) {
        li.classList.add("revelada");
        li.querySelector(".sopa-palabra-item__badge").textContent = "Revelada";
      }
    }
  });

  finalizarPartida(false);
});

// Reinicio del juego generando siempre nuevas palabras y letras mediante IA
btnReiniciar.addEventListener("click", () => {
  generarNuevasPalabrasConIA();
});

// Botón explícito para generar con IA
if (btnGenerarIA) {
  btnGenerarIA.addEventListener("click", () => {
    generarNuevasPalabrasConIA();
  });
}

selectDificultad.addEventListener("change", () => {
  generarNuevasPalabrasConIA();
});

/**
 * Temporizador
 */
function iniciarTemporizador() {
  detenerTemporizador();
  intervaloTiempo = setInterval(() => {
    tiempoSegundos++;
    actualizarIndicadores();
  }, 1000);
}

function detenerTemporizador() {
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }
}

function formatearTiempo(seg) {
  const m = Math.floor(seg / 60).toString().padStart(2, "0");
  const s = (seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function actualizarIndicadores() {
  statPalabras.textContent = `${palabrasEncontradas.size}/${ubicacionesActuales.length} encontradas`;
  statTiempo.textContent = formatearTiempo(tiempoSegundos);
}

await inicializar();

