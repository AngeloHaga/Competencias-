// publico/js/modulos/pareja.js · Juego interactivo Encuentra la Pareja
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({ titulo: "Encuentra la pareja", roles: ["estudiante", "docente"] });

// Elementos DOM
const enlaceTemaCabecera = document.getElementById("enlaceTemaCabecera");
const controlDificultad = document.getElementById("controlDificultad");
const selectDificultad = document.getElementById("selectDificultad");
const statParejas = document.getElementById("statParejas");
const statIntentos = document.getElementById("statIntentos");
const statTiempo = document.getElementById("statTiempo");
const btnGenerarIA = document.getElementById("btnGenerarIA");
const btnReiniciar = document.getElementById("btnReiniciar");
const estadoVacio = document.getElementById("estadoVacio");
const enlaceTemaVacio = document.getElementById("enlaceTemaVacio");
const btnGenerarIAVacio = document.getElementById("btnGenerarIAVacio");
const contenedorRetroPareja = document.getElementById("contenedorRetroPareja");
const tableroTarjetas = document.getElementById("tableroTarjetas");

// Estado del juego
let temaActual = null;
let glosarioTema = [];
let cartasJuego = [];
let seleccionadas = [];
let bloqueado = false;
let parejasEncontradas = 0;
let totalParejasObjetivo = 0;
let intentos = 0;
let tiempoSegundos = 0;
let intervaloTiempo = null;
let juegoTerminado = false;

/**
 * Genera nuevas parejas didácticas con IA conectada al contenido curricular
 * @param {Object} opciones { silencioso: boolean }
 */
async function generarParejasConIA({ silencioso = false } = {}) {
  if (!temaActual) return false;
  if (!silencioso) ui.cargando(true);

  try {
    const cantSolicitada = parseInt(selectDificultad.value, 10) || 8;
    const nuevas = await api.ia("generar-parejas", {
      temaId: temaActual.id,
      cantidad: Math.max(10, cantSolicitada + 2)
    });

    if (Array.isArray(nuevas) && nuevas.length > 0) {
      // Filtrar y estructurar parejas válidas
      const validas = nuevas.filter((item) => {
        return item.termino && item.definicion && String(item.termino).trim().length > 1;
      }).map((item, idx) => ({
        id: item.id || `ia_pareja_${Date.now()}_${idx}`,
        temaId: temaActual.id,
        termino: String(item.termino).trim(),
        definicion: String(item.definicion).trim(),
        retroalimentacion: item.retroalimentacion || "",
        esIA: true
      }));

      if (validas.length >= 4) {
        // Enriquecer el glosario sin duplicados por término normalizado
        const mapa = new Map(glosarioTema.map((g) => [util.normalizar(g.termino), g]));
        validas.forEach((v) => {
          const k = util.normalizar(v.termino);
          if (!mapa.has(k)) {
            glosarioTema.push(v);
          }
        });

        tableroTarjetas.style.display = "";
        controlDificultad.style.display = "";
        btnReiniciar.style.display = "";
        estadoVacio.style.display = "none";

        if (!silencioso) {
          ui.aviso(`✨ Se generaron ${validas.length} nuevas parejas didácticas con IA`, "exito");
        }

        iniciarPartida();
        return true;
      }
    }

    if (!silencioso) {
      ui.aviso("La IA no devolvió suficientes parejas, usando conceptos existentes.", "advertencia");
    }
    return false;
  } catch (err) {
    if (!silencioso) {
      ui.aviso(`No se pudo conectar con la IA (${err.message}). Usando conceptos del contenido.`, "advertencia");
    }
    return false;
  } finally {
    if (!silencioso) ui.cargando(false);
  }
}

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
    // Filtrar términos con definición válida
    glosarioTema = glosario.filter((g) => g.termino && g.definicion);

    if (glosarioTema.length < 4) {
      // Intentar generar automáticamente con IA si el tema no tiene suficientes términos
      const logradaConIA = await generarParejasConIA({ silencioso: true });
      if (!logradaConIA) {
        tableroTarjetas.style.display = "none";
        controlDificultad.style.display = "none";
        btnReiniciar.style.display = "none";
        estadoVacio.style.display = "flex";
        return;
      }
      return;
    }

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la actividad", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Inicia una partida barajando cartas
 */
function iniciarPartida() {
  detenerTemporizador();
  tiempoSegundos = 0;
  intentos = 0;
  parejasEncontradas = 0;
  seleccionadas = [];
  bloqueado = false;
  juegoTerminado = false;
  contenedorRetroPareja.innerHTML = "";

  // Determinar cantidad de parejas según dificultad y términos disponibles
  const difSolicitada = parseInt(selectDificultad.value, 10) || 6;
  totalParejasObjetivo = Math.min(difSolicitada, glosarioTema.length);
  // Al menos 4 si hay disponibles
  if (totalParejasObjetivo < 4) totalParejasObjetivo = Math.min(4, glosarioTema.length);

  actualizarIndicadores();

  // Seleccionar términos al azar
  const terminosElegidos = util.barajar(glosarioTema).slice(0, totalParejasObjetivo);

  // Crear dos tarjetas por cada término: una con el término y otra con la definición
  const listaCartas = [];
  terminosElegidos.forEach((item, index) => {
    // Carta Término
    listaCartas.push({
      idUnico: `t_${item.id}_${index}`,
      terminoId: item.id,
      tipo: "termino",
      texto: item.termino,
      itemOriginal: item
    });
    // Carta Definición
    listaCartas.push({
      idUnico: `d_${item.id}_${index}`,
      terminoId: item.id,
      tipo: "definicion",
      texto: item.definicion,
      itemOriginal: item
    });
  });

  // Barajar con util.barajar
  cartasJuego = util.barajar(listaCartas);

  renderizarTablero();
  iniciarTemporizador();
}

/**
 * Renderiza la cuadrícula de tarjetas
 */
function renderizarTablero() {
  tableroTarjetas.innerHTML = "";

  cartasJuego.forEach((carta) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "carta-pareja";
    boton.dataset.id = carta.idUnico;
    boton.setAttribute("aria-label", "Tarjeta boca abajo");
    boton.setAttribute("aria-expanded", "false");

    const inner = document.createElement("div");
    inner.className = "carta-pareja__inner";

    // Cara trasera (boca abajo)
    const caraTrasera = document.createElement("div");
    caraTrasera.className = "carta-cara carta-cara--trasera";
    caraTrasera.innerHTML = `
      <span class="carta-icono-trasero" aria-hidden="true">🧩</span>
      <span class="carta-texto-trasero">Descubrir</span>
    `;

    // Cara delantera (término o definición)
    const caraDelantera = document.createElement("div");
    caraDelantera.className = "carta-cara carta-cara--delantera";

    const badgeTipo = document.createElement("span");
    badgeTipo.className = `carta-tipo carta-tipo--${carta.tipo}`;
    badgeTipo.textContent = carta.tipo === "termino" ? "Concepto" : "Definición";

    const pTexto = document.createElement("p");
    pTexto.className = `carta-contenido ${carta.tipo === "termino" ? "carta-contenido--termino" : ""}`;
    pTexto.textContent = carta.texto;

    caraDelantera.appendChild(badgeTipo);
    caraDelantera.appendChild(pTexto);

    inner.appendChild(caraTrasera);
    inner.appendChild(caraDelantera);
    boton.appendChild(inner);

    boton.addEventListener("click", () => voltearCarta(carta, boton));
    tableroTarjetas.appendChild(boton);
  });
}

/**
 * Maneja el clic en una tarjeta
 * @param {Object} carta
 * @param {HTMLButtonElement} boton
 */
async function voltearCarta(carta, boton) {
  if (bloqueado || juegoTerminado) return;
  if (boton.classList.contains("volteada") || boton.classList.contains("acertada")) return;

  // Voltear tarjeta
  boton.classList.add("volteada");
  boton.setAttribute("aria-expanded", "true");
  boton.setAttribute("aria-label", `${carta.tipo === "termino" ? "Concepto" : "Definición"}: ${carta.texto}`);
  seleccionadas.push({ carta, boton });

  if (seleccionadas.length === 2) {
    intentos++;
    actualizarIndicadores();

    const [primera, segunda] = seleccionadas;
    // Comprobar si forman pareja (mismo terminoId y tipos distintos)
    const esPareja = primera.carta.terminoId === segunda.carta.terminoId && primera.carta.tipo !== segunda.carta.tipo;

    if (esPareja) {
      // Dejar descubiertas como acertadas
      primera.boton.classList.add("acertada");
      segunda.boton.classList.add("acertada");
      parejasEncontradas++;
      actualizarIndicadores();

      // Mostrar retroalimentación inmediata sobre la definición
      const defOriginal = primera.carta.itemOriginal.definicion || segunda.carta.itemOriginal.definicion;
      const panelRetro = mostrarRetro({
        correcto: true,
        explicacion: `<strong>${primera.carta.itemOriginal.termino}:</strong> ${defOriginal}`,
        sugerencia: primera.carta.itemOriginal.retroalimentacion || ""
      });
      contenedorRetroPareja.innerHTML = "";
      contenedorRetroPareja.appendChild(panelRetro);

      seleccionadas = [];

      // Comprobar si completó todas las parejas
      if (parejasEncontradas === totalParejasObjetivo) {
        finalizarJuego();
      }
    } else {
      // No forman pareja: voltear de nuevo a los 1.2 segundos
      bloqueado = true;
      setTimeout(() => {
        primera.boton.classList.remove("volteada");
        segunda.boton.classList.remove("volteada");
        primera.boton.setAttribute("aria-expanded", "false");
        segunda.boton.setAttribute("aria-expanded", "false");
        primera.boton.setAttribute("aria-label", "Tarjeta boca abajo");
        segunda.boton.setAttribute("aria-label", "Tarjeta boca abajo");
        seleccionadas = [];
        bloqueado = false;
      }, 1200);
    }
  }
}

/**
 * Finaliza la partida, registra intento y muestra el resumen formativo
 */
async function finalizarJuego() {
  juegoTerminado = true;
  detenerTemporizador();

  const duracionSeg = Math.max(1, tiempoSegundos);
  const fallos = Math.max(0, intentos - totalParejasObjetivo);
  // Puntaje: máximo entre 0 y 10 - (intentos - parejas)
  const puntaje = Math.max(0, 10 - fallos);
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Registrar intento para gamificación en el servidor
  try {
    await registrarIntento({
      actividad: "pareja",
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores: fallos,
      duracionSeg
    });
  } catch {
    // Manejo de error de red sin bloquear la experiencia
  }

  // Mostrar modal de resumen
  const accion = await mostrarResumen({
    titulo: "¡Todas las parejas encontradas!",
    aciertos: totalParejasObjetivo,
    errores: fallos,
    recomendaciones: fallos > 3 ? ["Repasa el glosario de términos para asociar conceptos más rápido."] : [],
    enlaceTema
  });

  if (accion === "repetir") {
    generarParejasConIA({ silencioso: true });
  }
}

/**
 * Control del temporizador
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
  statParejas.textContent = `${parejasEncontradas}/${totalParejasObjetivo} parejas`;
  statIntentos.textContent = `${intentos} intentos`;
  statTiempo.textContent = formatearTiempo(tiempoSegundos);
}

selectDificultad.addEventListener("change", () => {
  generarParejasConIA({ silencioso: true });
});

btnReiniciar.addEventListener("click", () => {
  generarParejasConIA({ silencioso: false });
});

if (btnGenerarIA) {
  btnGenerarIA.addEventListener("click", () => {
    generarParejasConIA({ silencioso: false });
  });
}

if (btnGenerarIAVacio) {
  btnGenerarIAVacio.addEventListener("click", () => {
    generarParejasConIA({ silencioso: false });
  });
}

await inicializar();

