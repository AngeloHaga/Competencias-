// publico/js/modulos/crucigrama.js · Juego interactivo Crucigrama Temático
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({ titulo: "Crucigrama", roles: ["estudiante", "docente"] });

/**
 * Función pura exportada: genera un crucigrama conectando palabras en cruces válidos.
 * Realiza 30 intentos con órdenes aleatorios y conserva el que coloque más palabras con menor área.
 * @param {Array<{termino: string, pista: string, definicion?: string}>} palabras - Lista de candidatos
 * @returns {{ filas: number, columnas: number, entradas: Array<{ numero: number, palabra: string, pista: string, definicion: string, fila: number, col: number, direccion: "H"|"V" }> }}
 */
export function generarCrucigrama(palabras) {
  if (!Array.isArray(palabras) || palabras.length === 0) {
    return { filas: 0, columnas: 0, entradas: [] };
  }

  // Normalizar y filtrar palabras válidas (3 a 12 letras)
  const listaBase = palabras
    .map((p) => {
      const termino = typeof p === "string" ? p : p.termino || "";
      const norm = util.normalizar(termino).replace(/[^A-ZÑ]/g, "");
      const pista = typeof p === "string" ? p : (p.pista || p.definicion || termino);
      const definicion = typeof p === "string" ? p : (p.definicion || p.pista || termino);
      return { terminoOriginal: termino, palabra: norm, pista, definicion, itemOriginal: p };
    })
    .filter((item) => item.palabra.length >= 3 && item.palabra.length <= 12);

  if (listaBase.length === 0) {
    return { filas: 0, columnas: 0, entradas: [] };
  }

  // Objetivo de 8 a 12 palabras
  const objetivoPalabras = Math.min(12, Math.max(8, listaBase.length));

  let mejorResultado = null;
  let maxPalabrasColocadas = -1;
  let menorArea = Infinity;

  // Repetir con 30 órdenes aleatorios
  for (let ordenIntento = 0; ordenIntento < 30; ordenIntento++) {
    // Tomar candidatos y ordenar: el primero es el más largo y el resto barajados
    const barajados = util.barajar([...listaBase]);
    barajados.sort((a, b) => b.palabra.length - a.palabra.length);
    const primera = barajados[0];
    const restantes = util.barajar(barajados.slice(1));
    const candidatos = [primera, ...restantes];

    // Espacio de colocación amplio (matriz 60×60 con centro en 30,30)
    const OFFSET = 30;
    const mapa = new Map(); // clave "r,c" -> { letra, horizId, vertId }
    const entradasColocadas = [];

    // Colocar la primera palabra horizontal en el centro
    const fInicioPrimera = OFFSET;
    const cInicioPrimera = OFFSET - Math.floor(primera.palabra.length / 2);

    for (let i = 0; i < primera.palabra.length; i++) {
      const r = fInicioPrimera;
      const c = cInicioPrimera + i;
      mapa.set(`${r},${c}`, {
        letra: primera.palabra[i],
        horizId: 0,
        vertId: null
      });
    }

    entradasColocadas.push({
      palabra: primera.palabra,
      pista: primera.pista,
      definicion: primera.definicion,
      itemOriginal: primera.itemOriginal,
      fila: fInicioPrimera,
      col: cInicioPrimera,
      direccion: "H"
    });

    // Intentar cruzar cada siguiente palabra
    for (let idx = 1; idx < candidatos.length; idx++) {
      if (entradasColocadas.length >= objetivoPalabras) break;
      const item = candidatos[idx];
      const palabra = item.palabra;

      let mejorCruce = null;

      // Buscar todas las posibles intersecciones con letras ya colocadas
      for (const [coord, celda] of mapa.entries()) {
        const [cr, cc] = coord.split(",").map(Number);

        // Si la letra coincide con alguna posición de la nueva palabra
        for (let pos = 0; pos < palabra.length; pos++) {
          if (palabra[pos] !== celda.letra) continue;

          // Si en esa celda ya hay una palabra horizontal, la nueva debe ser vertical
          // Si ya hay vertical, la nueva debe ser horizontal. Si hay ambas, no se puede cruzar más.
          const direccionesPosibles = [];
          if (celda.horizId !== null && celda.vertId === null) {
            direccionesPosibles.push("V");
          } else if (celda.vertId !== null && celda.horizId === null) {
            direccionesPosibles.push("H");
          }

          for (const dir of direccionesPosibles) {
            const fNueva = dir === "V" ? cr - pos : cr;
            const cNueva = dir === "H" ? cc - pos : cc;

            if (esPosicionValida(palabra, fNueva, cNueva, dir, mapa, entradasColocadas.length)) {
              mejorCruce = { f: fNueva, c: cNueva, dir };
              break;
            }
          }
          if (mejorCruce) break;
        }
        if (mejorCruce) break;
      }

      if (mejorCruce) {
        // Colocar la palabra en el mapa
        const palabraId = entradasColocadas.length;
        for (let k = 0; k < palabra.length; k++) {
          const r = mejorCruce.dir === "V" ? mejorCruce.f + k : mejorCruce.f;
          const c = mejorCruce.dir === "H" ? mejorCruce.c + k : mejorCruce.c;
          const key = `${r},${c}`;
          const existente = mapa.get(key) || { letra: palabra[k], horizId: null, vertId: null };

          if (mejorCruce.dir === "H") existente.horizId = palabraId;
          if (mejorCruce.dir === "V") existente.vertId = palabraId;

          mapa.set(key, existente);
        }

        entradasColocadas.push({
          palabra,
          pista: item.pista,
          definicion: item.definicion,
          itemOriginal: item.itemOriginal,
          fila: mejorCruce.f,
          col: mejorCruce.c,
          direccion: mejorCruce.dir
        });
      }
    }

    // Calcular dimensiones de la cuadrícula
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const ent of entradasColocadas) {
      minR = Math.min(minR, ent.fila);
      minC = Math.min(minC, ent.col);
      if (ent.direccion === "H") {
        maxR = Math.max(maxR, ent.fila);
        maxC = Math.max(maxC, ent.col + ent.palabra.length - 1);
      } else {
        maxR = Math.max(maxR, ent.fila + ent.palabra.length - 1);
        maxC = Math.max(maxC, ent.col);
      }
    }

    const filas = maxR - minR + 1;
    const columnas = maxC - minC + 1;
    const area = filas * columnas;

    // Comparar con el mejor resultado
    const cantidad = entradasColocadas.length;
    if (
      cantidad > maxPalabrasColocadas ||
      (cantidad === maxPalabrasColocadas && area < menorArea)
    ) {
      maxPalabrasColocadas = cantidad;
      menorArea = area;
      mejorResultado = {
        minR,
        minC,
        filas,
        columnas,
        entradas: entradasColocadas
      };
    }
  }

  if (!mejorResultado || mejorResultado.entradas.length === 0) {
    return { filas: 0, columnas: 0, entradas: [] };
  }

  // Recortar la cuadrícula ajustando coordenadas relativas al origen (minR, minC)
  const { minR, minC, filas, columnas, entradas } = mejorResultado;

  // Asignar numeración a las entradas según orden de lectura (arriba a abajo, izquierda a derecha)
  // Agrupar casillas iniciales idénticas con el mismo número
  const casillasInicio = [];
  entradas.forEach((e) => {
    e.fila = e.fila - minR;
    e.col = e.col - minC;
    casillasInicio.push({ fila: e.fila, col: e.col });
  });

  // Ordenar casillas iniciales
  casillasInicio.sort((a, b) => a.fila - b.fila || a.col - b.col);
  const mapaNumeros = new Map();
  let numConsecutivo = 1;
  for (const { fila, col } of casillasInicio) {
    const key = `${fila},${col}`;
    if (!mapaNumeros.has(key)) {
      mapaNumeros.set(key, numConsecutivo++);
    }
  }

  entradas.forEach((e) => {
    e.numero = mapaNumeros.get(`${e.fila},${e.col}`);
  });

  // Ordenar entradas por número y luego dirección H antes de V
  entradas.sort((a, b) => a.numero - b.numero || (a.direccion === "H" ? -1 : 1));

  return { filas, columnas, entradas };
}

/**
 * Valida que una palabra no toque en paralelo ni en los extremos a otras palabras
 */
function esPosicionValida(palabra, fila, col, dir, mapa, palabraId) {
  const len = palabra.length;

  // 1. Validar extremo anterior (no puede haber letra inmediatamente antes)
  const extAntR = dir === "V" ? fila - 1 : fila;
  const extAntC = dir === "H" ? col - 1 : col;
  if (mapa.has(`${extAntR},${extAntC}`)) return false;

  // 2. Validar extremo posterior (no puede haber letra inmediatamente después)
  const extPostR = dir === "V" ? fila + len : fila;
  const extPostC = dir === "H" ? col + len : col;
  if (mapa.has(`${extPostR},${extPostC}`)) return false;

  let tieneAlMenosUnCruce = false;

  // 3. Validar cada casilla de la palabra y sus laterales
  for (let k = 0; k < len; k++) {
    const r = dir === "V" ? fila + k : fila;
    const c = dir === "H" ? col + k : col;
    const key = `${r},${c}`;
    const existente = mapa.get(key);

    if (existente) {
      // Debe coincidir exactamente con la letra
      if (existente.letra !== palabra[k]) return false;
      // No debe ser de la misma orientación que ya esté ocupada en esa casilla
      if (dir === "H" && existente.horizId !== null) return false;
      if (dir === "V" && existente.vertId !== null) return false;
      tieneAlMenosUnCruce = true;
    } else {
      // En casillas vacías nuevas, no debe haber letras inmediatamente adyacentes en paralelo
      if (dir === "H") {
        if (mapa.has(`${r - 1},${c}`) || mapa.has(`${r + 1},${c}`)) return false;
      } else {
        if (mapa.has(`${r},${c - 1}`) || mapa.has(`${r},${c + 1}`)) return false;
      }
    }
  }

  return tieneAlMenosUnCruce;
}

// Elementos DOM
const enlaceTemaCabecera = document.getElementById("enlaceTemaCabecera");
const statPalabras = document.getElementById("statPalabras");
const statReveladas = document.getElementById("statReveladas");
const statTiempo = document.getElementById("statTiempo");
const btnGenerarIA = document.getElementById("btnGenerarIA");
const btnReiniciar = document.getElementById("btnReiniciar");
const estadoVacio = document.getElementById("estadoVacio");
const enlaceTemaVacio = document.getElementById("enlaceTemaVacio");
const btnGenerarIAVacio = document.getElementById("btnGenerarIAVacio");
const pistaActivaNum = document.getElementById("pistaActivaNum");
const pistaActivaTexto = document.getElementById("pistaActivaTexto");
const contenedorRetroCrucigrama = document.getElementById("contenedorRetroCrucigrama");
const btnComprobar = document.getElementById("btnComprobar");
const btnRevelarLetra = document.getElementById("btnRevelarLetra");
const btnTerminar = document.getElementById("btnTerminar");
const grillaCrucigrama = document.getElementById("grillaCrucigrama");
const listaPistasH = document.getElementById("listaPistasH");
const listaPistasV = document.getElementById("listaPistasV");
const areaJuego = document.getElementById("areaJuego");
const accionesBarra = document.getElementById("accionesBarra");
const pistaActivaBarra = document.getElementById("pistaActivaBarra");

// Estado del juego
let temaActual = null;
let glosarioTema = [];
let crucigramaData = null; // { filas, columnas, entradas }
let matrizCasillas = []; // [f][c] -> objeto casilla
let entradaSeleccionada = null;
let casillaEnfocada = null; // { f, c }
let letrasReveladas = 0;
let palabrasResueltas = new Set();
let juegoTerminado = false;
let tiempoSegundos = 0;
let intervaloTiempo = null;

/**
 * Genera nuevas palabras y pistas de crucigrama con IA conectada al contenido temático
 * @param {Object} opciones { silencioso: boolean }
 */
async function generarCrucigramaConIA({ silencioso = false } = {}) {
  if (!temaActual) return false;
  if (!silencioso) ui.cargando(true);

  try {
    const nuevas = await api.ia("generar-crucigrama", {
      temaId: temaActual.id,
      cantidad: 15
    });

    if (Array.isArray(nuevas) && nuevas.length > 0) {
      // Filtrar términos de una sola palabra normalizada (entre 3 y 12 letras)
      const validas = nuevas.filter((item) => {
        const terminoLimpio = String(item.termino || "").trim();
        const norm = util.normalizar(terminoLimpio);
        return !terminoLimpio.includes(" ") && norm.length >= 3 && norm.length <= 12 && /^[A-ZÑ]+$/.test(norm);
      }).map((item, idx) => ({
        id: item.id || `ia_crucigrama_${Date.now()}_${idx}`,
        temaId: temaActual.id,
        termino: String(item.termino).trim().toUpperCase(),
        pista: item.pista || "Concepto clave del contenido",
        definicion: item.definicion || `Definición de ${item.termino}`,
        retroalimentacion: item.retroalimentacion || "",
        esIA: true
      }));

      if (validas.length >= 3) {
        // Enriquecer el listado sin duplicados
        const mapa = new Map(glosarioTema.map((g) => [util.normalizar(g.termino), g]));
        validas.forEach((v) => {
          const k = util.normalizar(v.termino);
          if (!mapa.has(k)) {
            glosarioTema.push(v);
          }
        });

        areaJuego.style.display = "";
        accionesBarra.style.display = "";
        pistaActivaBarra.style.display = "";
        btnReiniciar.style.display = "";
        estadoVacio.style.display = "none";

        if (!silencioso) {
          ui.aviso(`✨ Se generaron ${validas.length} palabras con IA y se configuró el crucigrama`, "exito");
        }

        iniciarPartida();
        return true;
      }
    }

    if (!silencioso) {
      ui.aviso("La IA no devolvió suficientes términos de 3 a 12 letras, usando palabras disponibles.", "advertencia");
    }
    return false;
  } catch (err) {
    if (!silencioso) {
      ui.aviso(`No se pudo conectar con la IA (${err.message}). Usando palabras del contenido.`, "advertencia");
    }
    return false;
  } finally {
    if (!silencioso) ui.cargando(false);
  }
}

/**
 * Inicialización
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

    // Filtrar términos de una sola palabra normalizada (3 a 12 letras)
    glosarioTema = glosario.filter((item) => {
      const terminoLimpio = String(item.termino || "").trim();
      const norm = util.normalizar(terminoLimpio);
      return !terminoLimpio.includes(" ") && norm.length >= 3 && norm.length <= 12;
    });

    if (glosarioTema.length < 4) {
      const logradaConIA = await generarCrucigramaConIA({ silencioso: true });
      if (!logradaConIA) {
        mostrarVacio();
        return;
      }
      return;
    }

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el crucigrama", "error");
  } finally {
    ui.cargando(false);
  }
}

function mostrarVacio() {
  areaJuego.style.display = "none";
  accionesBarra.style.display = "none";
  pistaActivaBarra.style.display = "none";
  btnReiniciar.style.display = "none";
  estadoVacio.style.display = "flex";
}

/**
 * Inicia o reinicia la partida
 */
function iniciarPartida() {
  detenerTemporizador();
  tiempoSegundos = 0;
  letrasReveladas = 0;
  palabrasResueltas.clear();
  entradaSeleccionada = null;
  casillaEnfocada = null;
  juegoTerminado = false;
  contenedorRetroCrucigrama.innerHTML = "";

  // Tomar hasta 15 candidatos al azar
  const candidatos = util.barajar(glosarioTema).slice(0, 15);
  crucigramaData = generarCrucigrama(candidatos);

  if (!crucigramaData || crucigramaData.entradas.length === 0) {
    mostrarVacio();
    return;
  }

  construirMatrizCasillas();
  renderizarTablero();
  renderizarListasPistas();
  actualizarIndicadores();
  iniciarTemporizador();

  // Seleccionar la primera entrada por defecto
  if (crucigramaData.entradas.length > 0) {
    seleccionarEntrada(crucigramaData.entradas[0], 0);
  }
}

/**
 * Construye la matriz bidimensional de casillas activas y bloqueadas
 */
function construirMatrizCasillas() {
  const { filas, columnas, entradas } = crucigramaData;
  matrizCasillas = Array.from({ length: filas }, () =>
    Array.from({ length: columnas }, () => ({
      activa: false,
      letraCorrecta: "",
      numero: null,
      entradasH: null,
      entradasV: null,
      valorUsuario: "",
      revelada: false
    }))
  );

  entradas.forEach((e) => {
    // Casilla de inicio con número
    matrizCasillas[e.fila][e.col].numero = e.numero;

    for (let i = 0; i < e.palabra.length; i++) {
      const f = e.direccion === "V" ? e.fila + i : e.fila;
      const c = e.direccion === "H" ? e.col + i : e.col;
      const celda = matrizCasillas[f][c];
      celda.activa = true;
      celda.letraCorrecta = e.palabra[i];
      if (e.direccion === "H") celda.entradasH = e;
      if (e.direccion === "V") celda.entradasV = e;
    }
  });
}

/**
 * Renderiza la cuadrícula de casillas en el DOM
 */
function renderizarTablero() {
  const { filas, columnas } = crucigramaData;
  grillaCrucigrama.innerHTML = "";
  grillaCrucigrama.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const datosCasilla = matrizCasillas[f][c];
      const div = document.createElement("div");
      div.className = `casilla-crucigrama ${datosCasilla.activa ? "activa" : "bloqueada"}`;
      div.dataset.fila = String(f);
      div.dataset.col = String(c);

      if (datosCasilla.activa) {
        if (datosCasilla.numero) {
          const numSpan = document.createElement("span");
          numSpan.className = "casilla-numero";
          numSpan.textContent = String(datosCasilla.numero);
          div.appendChild(numSpan);
        }

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.className = "casilla-input";
        input.value = datosCasilla.valorUsuario;
        input.setAttribute("aria-label", `Fila ${f + 1}, columna ${c + 1}`);

        // Eventos de casilla
        input.addEventListener("focus", () => enfocarCasilla(f, c));
        input.addEventListener("keydown", (e) => manejarTecladoCasilla(e, f, c));
        input.addEventListener("input", (e) => manejarEntradaTexto(e, f, c));
        div.addEventListener("dblclick", () => alternarDireccionEnCasilla(f, c));

        div.appendChild(input);
      }

      grillaCrucigrama.appendChild(div);
    }
  }
}

/**
 * Renderiza las listas de pistas Horizontales y Verticales
 */
function renderizarListasPistas() {
  listaPistasH.innerHTML = "";
  listaPistasV.innerHTML = "";

  crucigramaData.entradas.forEach((entrada) => {
    const li = document.createElement("li");
    li.className = "pista-item";
    li.id = `pista-${entrada.direccion}-${entrada.numero}`;
    li.innerHTML = `
      <span class="pista-item__numero">${entrada.numero}.</span>
      <span class="pista-item__texto">${ui.escapar(entrada.pista)} <span class="texto-suave texto-xs">(${entrada.palabra.length})</span></span>
    `;

    li.addEventListener("click", () => {
      seleccionarEntrada(entrada, 0);
    });

    if (entrada.direccion === "H") {
      listaPistasH.appendChild(li);
    } else {
      listaPistasV.appendChild(li);
    }
  });
}

/**
 * Selecciona una entrada (palabra completa) y enfoca una casilla específica
 */
function seleccionarEntrada(entrada, indiceCasilla = 0) {
  if (juegoTerminado || !entrada) return;
  entradaSeleccionada = entrada;

  // Actualizar barra de pista activa
  pistaActivaNum.textContent = `${entrada.numero} ${entrada.direccion === "H" ? "Horiz." : "Vert."}:`;
  pistaActivaTexto.textContent = `${entrada.pista} (${entrada.palabra.length} letras)`;

  // Resaltar pista en la lista
  document.querySelectorAll(".pista-item").forEach((el) => el.classList.remove("activa"));
  const pistaLi = document.getElementById(`pista-${entrada.direccion}-${entrada.numero}`);
  if (pistaLi) pistaLi.classList.add("activa");

  // Resaltar celdas de la palabra en la grilla
  actualizarResaltadoGrilla();

  // Enfocar casilla solicitada
  const f = entrada.direccion === "V" ? entrada.fila + indiceCasilla : entrada.fila;
  const c = entrada.direccion === "H" ? entrada.col + indiceCasilla : entrada.col;
  enfocarCasilla(f, c, false);
}

/**
 * Maneja el enfoque de una casilla
 */
function enfocarCasilla(f, c, cambiarEntrada = true) {
  casillaEnfocada = { f, c };
  const celda = matrizCasillas[f][c];
  if (!celda.activa) return;

  if (cambiarEntrada) {
    // Si la casilla forma parte de la entrada actual, mantenerla;
    // de lo contrario, seleccionar la entrada horizontal o vertical disponible
    const esDeActual =
      entradaSeleccionada &&
      ((entradaSeleccionada.direccion === "H" && celda.entradasH === entradaSeleccionada) ||
        (entradaSeleccionada.direccion === "V" && celda.entradasV === entradaSeleccionada));

    if (!esDeActual) {
      if (celda.entradasH) {
        entradaSeleccionada = celda.entradasH;
      } else if (celda.entradasV) {
        entradaSeleccionada = celda.entradasV;
      }
    }
  }

  actualizarResaltadoGrilla();

  // Foco en el input
  const input = obtenerInputCasilla(f, c);
  if (input && document.activeElement !== input) {
    input.focus();
    input.select();
  }
}

/**
 * Alterna dirección entre H y V cuando se presiona espacio o doble clic en un cruce
 */
function alternarDireccionEnCasilla(f, c) {
  const celda = matrizCasillas[f][c];
  if (!celda.activa) return;

  if (celda.entradasH && celda.entradasV) {
    if (entradaSeleccionada === celda.entradasH) {
      seleccionarEntrada(celda.entradasV, f - celda.entradasV.fila);
    } else {
      seleccionarEntrada(celda.entradasH, c - celda.entradasH.col);
    }
  }
}

/**
 * Resalta en el DOM las casillas de la palabra seleccionada y la casilla enfocada
 */
function actualizarResaltadoGrilla() {
  document.querySelectorAll(".casilla-crucigrama").forEach((el) => {
    el.classList.remove("palabra-seleccionada", "casilla-enfocada");
  });

  if (entradaSeleccionada) {
    for (let i = 0; i < entradaSeleccionada.palabra.length; i++) {
      const f = entradaSeleccionada.direccion === "V" ? entradaSeleccionada.fila + i : entradaSeleccionada.fila;
      const c = entradaSeleccionada.direccion === "H" ? entradaSeleccionada.col + i : entradaSeleccionada.col;
      const div = obtenerDivCasilla(f, c);
      if (div) div.classList.add("palabra-seleccionada");
    }
  }

  if (casillaEnfocada) {
    const div = obtenerDivCasilla(casillaEnfocada.f, casillaEnfocada.c);
    if (div) div.classList.add("casilla-enfocada");
  }
}

/**
 * Manejo de teclas: Flechas, Retroceso, Espacio para cambiar dirección
 */
function manejarTecladoCasilla(e, f, c) {
  if (juegoTerminado) return;

  if (e.key === " ") {
    e.preventDefault();
    alternarDireccionEnCasilla(f, c);
    return;
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    const celda = matrizCasillas[f][c];
    if (celda.valorUsuario !== "") {
      celda.valorUsuario = "";
      const input = obtenerInputCasilla(f, c);
      if (input) input.value = "";
    } else {
      // Retroceder a la casilla anterior en la dirección actual
      moverEnfoqueRelativo(-1);
    }
    return;
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    moverCasilla(f, c + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    moverCasilla(f, c - 1);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    moverCasilla(f + 1, c);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moverCasilla(f - 1, c);
  }
}

function moverCasilla(nuevaF, nuevaC) {
  const { filas, columnas } = crucigramaData;
  if (nuevaF >= 0 && nuevaF < filas && nuevaC >= 0 && nuevaC < columnas) {
    if (matrizCasillas[nuevaF][nuevaC].activa) {
      enfocarCasilla(nuevaF, nuevaC);
    }
  }
}

function moverEnfoqueRelativo(paso) {
  if (!entradaSeleccionada || !casillaEnfocada) return;
  const df = entradaSeleccionada.direccion === "V" ? paso : 0;
  const dc = entradaSeleccionada.direccion === "H" ? paso : 0;
  moverCasilla(casillaEnfocada.f + df, casillaEnfocada.c + dc);
}

/**
 * Maneja el ingreso de letras con avance automático
 */
function manejarEntradaTexto(e, f, c) {
  if (juegoTerminado) return;
  const celda = matrizCasillas[f][c];
  const input = obtenerInputCasilla(f, c);
  const texto = input.value;
  const norm = util.normalizar(texto).slice(-1).toUpperCase();

  if (/^[A-ZÑ]$/.test(norm)) {
    celda.valorUsuario = norm;
    input.value = norm;
    // Avance automático a la siguiente casilla de la entrada
    moverEnfoqueRelativo(1);
  } else {
    input.value = celda.valorUsuario;
  }
}

function obtenerDivCasilla(f, c) {
  return grillaCrucigrama.querySelector(`.casilla-crucigrama[data-fila="${f}"][data-col="${c}"]`);
}

function obtenerInputCasilla(f, c) {
  const div = obtenerDivCasilla(f, c);
  return div ? div.querySelector("input") : null;
}

/**
 * Botón "Comprobar palabra": verifica la palabra seleccionada actual
 */
btnComprobar.addEventListener("click", () => {
  if (juegoTerminado || !entradaSeleccionada) return;

  const entrada = entradaSeleccionada;
  let palabraIngresada = "";

  for (let i = 0; i < entrada.palabra.length; i++) {
    const f = entrada.direccion === "V" ? entrada.fila + i : entrada.fila;
    const c = entrada.direccion === "H" ? entrada.col + i : entrada.col;
    palabraIngresada += matrizCasillas[f][c].valorUsuario;
  }

  const esCorrecta = palabraIngresada === entrada.palabra;

  // Marcar visualmente las casillas
  for (let i = 0; i < entrada.palabra.length; i++) {
    const f = entrada.direccion === "V" ? entrada.fila + i : entrada.fila;
    const c = entrada.direccion === "H" ? entrada.col + i : entrada.col;
    const div = obtenerDivCasilla(f, c);
    if (div) {
      div.classList.remove("correcta", "incorrecta");
      div.classList.add(esCorrecta ? "correcta" : "incorrecta");
    }
  }

  if (esCorrecta) {
    palabrasResueltas.add(`${entrada.direccion}-${entrada.numero}`);
    const pistaLi = document.getElementById(`pista-${entrada.direccion}-${entrada.numero}`);
    if (pistaLi) pistaLi.classList.add("resuelta");
  }

  // Mostrar retroalimentación con la definición
  const panelRetro = mostrarRetro({
    correcto: esCorrecta,
    explicacion: `<strong>${entrada.itemOriginal?.termino || entrada.palabra}:</strong> ${entrada.definicion}`,
    sugerencia: entrada.pista
  });
  contenedorRetroCrucigrama.innerHTML = "";
  contenedorRetroCrucigrama.appendChild(panelRetro);

  actualizarIndicadores();

  // Comprobar si completó todas las palabras
  if (palabrasResueltas.size === crucigramaData.entradas.length) {
    finalizarCrucigrama();
  }
});

/**
 * Botón "Revelar letra": revela la letra correcta en la casilla enfocada (máximo 3)
 */
btnRevelarLetra.addEventListener("click", () => {
  if (juegoTerminado || !casillaEnfocada || letrasReveladas >= 3) return;

  const { f, c } = casillaEnfocada;
  const celda = matrizCasillas[f][c];
  if (!celda.activa) return;

  celda.valorUsuario = celda.letraCorrecta;
  celda.revelada = true;
  const input = obtenerInputCasilla(f, c);
  if (input) input.value = celda.letraCorrecta;

  const div = obtenerDivCasilla(f, c);
  if (div) div.classList.add("revelada");

  letrasReveladas++;
  actualizarIndicadores();

  // Avanzar a la siguiente casilla
  moverEnfoqueRelativo(1);
});

/**
 * Botón "Terminar": finaliza la partida
 */
btnTerminar.addEventListener("click", () => {
  if (juegoTerminado) return;
  finalizarCrucigrama();
});

/**
 * Finaliza la partida, registra intento y muestra resumen
 */
async function finalizarCrucigrama() {
  juegoTerminado = true;
  detenerTemporizador();
  btnComprobar.disabled = true;
  btnRevelarLetra.disabled = true;
  btnTerminar.disabled = true;

  // Deshabilitar inputs
  grillaCrucigrama.querySelectorAll("input").forEach((inp) => (inp.disabled = true));

  // Verificar todas las palabras y revelar faltantes
  crucigramaData.entradas.forEach((entrada) => {
    let formada = "";
    for (let i = 0; i < entrada.palabra.length; i++) {
      const f = entrada.direccion === "V" ? entrada.fila + i : entrada.fila;
      const c = entrada.direccion === "H" ? entrada.col + i : entrada.col;
      formada += matrizCasillas[f][c].valorUsuario;
    }

    if (formada === entrada.palabra) {
      palabrasResueltas.add(`${entrada.direccion}-${entrada.numero}`);
    } else {
      // Revelar letras de palabras no resueltas
      for (let i = 0; i < entrada.palabra.length; i++) {
        const f = entrada.direccion === "V" ? entrada.fila + i : entrada.fila;
        const c = entrada.direccion === "H" ? entrada.col + i : entrada.col;
        const div = obtenerDivCasilla(f, c);
        const inp = obtenerInputCasilla(f, c);
        if (inp && inp.value !== entrada.palabra[i]) {
          inp.value = entrada.palabra[i];
          if (div) div.classList.add("revelada");
        }
      }
    }
  });

  const total = crucigramaData.entradas.length;
  const correctas = palabrasResueltas.size;
  const incorrectas = total - correctas;
  // Errores = incorrectas + letras reveladas
  const errores = incorrectas + letrasReveladas;
  const duracionSeg = Math.max(1, tiempoSegundos);
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  try {
    await registrarIntento({
      actividad: "crucigrama",
      temaId: temaActual.id,
      puntaje: correctas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch {
    // Silencioso ante fallos de conexión
  }

  const accion = await mostrarResumen({
    titulo: correctas === total ? "¡Excelente! Crucigrama completado" : "Crucigrama finalizado",
    aciertos: correctas,
    errores,
    recomendaciones: errores > 0 ? ["Repasa las pistas y definiciones clave del glosario."] : [],
    enlaceTema
  });

  if (accion === "repetir") {
    generarCrucigramaConIA({ silencioso: true });
  }
}

btnReiniciar.addEventListener("click", () => {
  generarCrucigramaConIA({ silencioso: false });
});

if (btnGenerarIA) {
  btnGenerarIA.addEventListener("click", () => {
    generarCrucigramaConIA({ silencioso: false });
  });
}

if (btnGenerarIAVacio) {
  btnGenerarIAVacio.addEventListener("click", () => {
    generarCrucigramaConIA({ silencioso: false });
  });
}

/**
 * Temporizador y Métricas
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
  const total = crucigramaData ? crucigramaData.entradas.length : 0;
  statPalabras.textContent = `${palabrasResueltas.size}/${total} resueltas`;
  statReveladas.textContent = `Letras reveladas: ${letrasReveladas}/3`;
  statTiempo.textContent = formatearTiempo(tiempoSegundos);

  btnRevelarLetra.disabled = letrasReveladas >= 3 || juegoTerminado;
  btnRevelarLetra.textContent = `💡 Revelar letra (${3 - letrasReveladas} disponibles)`;
}

await inicializar();

