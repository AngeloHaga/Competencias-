// publico/js/modulos/ahorcado.js · Juego educativo del Ahorcado
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({ titulo: "Ahorcado", roles: ["estudiante", "docente"] });

// Letras del teclado en español
const LETRAS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
];

// Elementos DOM
const enlaceTemaCabecera = document.getElementById("enlaceTemaCabecera");
const contadorIntentosRestantes = document.getElementById("contadorIntentosRestantes");
const btnGenerarIA = document.getElementById("btnGenerarIA");
const btnOtraPalabra = document.getElementById("btnOtraPalabra");
const estadoVacio = document.getElementById("estadoVacio");
const estadoTablero = document.getElementById("estadoTablero");
const enlaceTemaVacio = document.getElementById("enlaceTemaVacio");
const btnGenerarIAVacio = document.getElementById("btnGenerarIAVacio");
const globoSvg = document.getElementById("globoSvg");
const textoPista = document.getElementById("textoPista");
const contenedorCasillas = document.getElementById("contenedorCasillas");
const contenedorRetro = document.getElementById("contenedorRetro");
const tecladoEnPantalla = document.getElementById("tecladoEnPantalla");

// Estado del juego
let temaActual = null;
let terminosDisponibles = [];
let terminosUsados = new Set();
let terminoActual = null;
let palabraNormalizada = "";
let letrasAdivinadas = new Set();
let letrasIntentadas = new Set();
let errores = 0;
let juegoTerminado = false;
let tiempoInicio = Date.now();

/**
 * Genera nuevas palabras de 6 letras mediante IA conectada al contenido temático
 * @param {Object} opciones { silencioso: boolean }
 */
async function generarPalabrasConIA({ silencioso = false } = {}) {
  if (!temaActual) return false;
  if (!silencioso) ui.cargando(true);

  try {
    const nuevas = await api.ia("generar-ahorcado", {
      temaId: temaActual.id,
      cantidad: 6
    });

    if (Array.isArray(nuevas) && nuevas.length > 0) {
      // Filtrar estrictamente términos de exactamente 6 letras válidas
      const validas = nuevas.filter((item) => {
        const texto = String(item.termino || "").trim();
        const norm = util.normalizar(texto);
        return norm.length === 6 && /^[A-ZÑ]+$/.test(norm);
      }).map((item, idx) => ({
        id: item.id || `ia_ahorcado_${Date.now()}_${idx}`,
        termino: item.termino.trim().toUpperCase(),
        pista: item.pista || "Concepto clave del tema",
        definicion: item.definicion || `Definición de ${item.termino}`,
        retroalimentacion: item.retroalimentacion || "",
        esIA: true
      }));

      if (validas.length > 0) {
        // Integrar al listado sin duplicados
        const mapa = new Map(terminosDisponibles.map((t) => [util.normalizar(t.termino), t]));
        validas.forEach((v) => {
          const k = util.normalizar(v.termino);
          if (!mapa.has(k)) {
            terminosDisponibles.push(v);
          }
        });

        // Asegurar que la interfaz esté visible si estaba en estado vacío
        estadoVacio.style.display = "none";
        estadoTablero.style.display = "grid";
        tecladoEnPantalla.style.display = "grid";
        btnOtraPalabra.style.display = "";

        if (!silencioso) {
          ui.aviso(`✨ Se generaron ${validas.length} palabras de 6 letras con IA`, "exito");
        }

        iniciarPartida();
        return true;
      }
    }

    if (!silencioso) {
      ui.aviso("La IA no devolvió palabras de 6 letras válidas. Usando términos disponibles.", "advertencia");
    }
    return false;
  } catch (err) {
    if (!silencioso) {
      ui.aviso(`No se pudo conectar con la IA (${err.message}).`, "advertencia");
    }
    return false;
  } finally {
    if (!silencioso) ui.cargando(false);
  }
}

/**
 * Inicializa la partida cargando el tema y sus términos de 6 letras
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
    
    // Filtrar términos aprobados cuyo término normalizado tenga exactamente 6 letras
    terminosDisponibles = glosario.filter((item) => {
      const norm = util.normalizar(item.termino || "");
      return norm.length === 6;
    });

    if (terminosDisponibles.length === 0) {
      // Intentar generar automáticamente con IA si el contenido temático no tiene términos de 6 letras
      const logradaConIA = await generarPalabrasConIA({ silencioso: true });
      if (!logradaConIA) {
        estadoTablero.style.display = "none";
        tecladoEnPantalla.style.display = "none";
        btnOtraPalabra.style.display = "none";
        estadoVacio.style.display = "flex";
        return;
      }
      return;
    }

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el juego del Ahorcado", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Inicia una nueva ronda eligiendo una palabra no usada
 */
function iniciarPartida() {
  // Términos candidatos no usados en esta sesión
  let candidatos = terminosDisponibles.filter((t) => !terminosUsados.has(t.id));
  if (candidatos.length === 0) {
    // Si ya se usaron todos, reiniciar el conjunto de usados
    terminosUsados.clear();
    candidatos = terminosDisponibles;
  }

  // Elegir uno al azar
  terminoActual = candidatos[Math.floor(Math.random() * candidatos.length)];
  terminosUsados.add(terminoActual.id);
  palabraNormalizada = util.normalizar(terminoActual.termino);

  // Reiniciar estado
  letrasAdivinadas.clear();
  letrasIntentadas.clear();
  errores = 0;
  juegoTerminado = false;
  tiempoInicio = Date.now();
  contenedorRetro.innerHTML = "";

  // Mostrar pista
  textoPista.textContent = terminoActual.pista || "Adivina la palabra oculta según el contexto del tema.";

  actualizarEstadoGlobo();
  renderizarCasillas();
  renderizarTeclado();
}

/**
 * Actualiza el contador de vidas y el estado gráfico del globo SVG
 */
function actualizarEstadoGlobo() {
  const vidasRestantes = Math.max(0, 3 - errores);
  contadorIntentosRestantes.textContent = `Vidas: ${vidasRestantes}/3`;
  
  if (vidasRestantes === 0) {
    contadorIntentosRestantes.className = "insignia insignia--error";
  } else if (vidasRestantes === 1) {
    contadorIntentosRestantes.className = "insignia insignia--advertencia";
  } else {
    contadorIntentosRestantes.className = "insignia insignia--secundario";
  }

  globoSvg.className.baseVal = `globo-svg estado-${errores}`;
}

/**
 * Renderiza las 6 casillas de la palabra
 */
function renderizarCasillas(revelarTodas = false) {
  contenedorCasillas.innerHTML = "";

  for (let i = 0; i < palabraNormalizada.length; i++) {
    const letra = palabraNormalizada[i];
    const adivinada = letrasAdivinadas.has(letra);
    const div = document.createElement("div");
    div.className = "casilla-letra";

    if (adivinada) {
      div.textContent = letra;
      div.classList.add("casilla-letra--acertada");
    } else if (revelarTodas) {
      div.textContent = letra;
      div.classList.add("casilla-letra--revelada");
    } else {
      div.textContent = "";
    }

    contenedorCasillas.appendChild(div);
  }
}

/**
 * Renderiza el teclado virtual en pantalla
 */
function renderizarTeclado() {
  tecladoEnPantalla.innerHTML = "";

  LETRAS.forEach((letra) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tecla-letra";
    btn.textContent = letra;
    btn.dataset.letra = letra;

    if (letrasIntentadas.has(letra)) {
      btn.disabled = true;
      if (palabraNormalizada.includes(letra)) {
        btn.classList.add("tecla-letra--acierto");
      } else {
        btn.classList.add("tecla-letra--fallo");
      }
    }

    btn.addEventListener("click", () => procesarIntentoLetra(letra));
    tecladoEnPantalla.appendChild(btn);
  });
}

/**
 * Procesa la letra jugada por el usuario
 * @param {string} letra
 */
async function procesarIntentoLetra(letra) {
  if (juegoTerminado) return;
  const letraNorm = util.normalizar(letra).slice(0, 1);
  if (!letraNorm || letrasIntentadas.has(letraNorm)) return;

  letrasIntentadas.add(letraNorm);

  if (palabraNormalizada.includes(letraNorm)) {
    letrasAdivinadas.add(letraNorm);
  } else {
    errores++;
  }

  actualizarEstadoGlobo();
  renderizarCasillas();
  renderizarTeclado();

  // Comprobar si ganó: todas las letras de la palabra fueron adivinadas
  const gano = [...palabraNormalizada].every((l) => letrasAdivinadas.has(l));
  
  // Se permiten 3 errores: el juego termina en el cuarto error
  const perdio = errores >= 4;

  if (gano || perdio) {
    juegoTerminado = true;
    deshabilitarTeclado();
    renderizarCasillas(true); // Revela la palabra completa si no la adivinó

    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;
    const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

    // Mostrar panel .retro
    const panelRetro = mostrarRetro({
      correcto: gano,
      explicacion: terminoActual.definicion || `La palabra correcta es ${terminoActual.termino}.`,
      sugerencia: terminoActual.retroalimentacion || "",
      enlaceTema
    });
    contenedorRetro.innerHTML = "";
    contenedorRetro.appendChild(panelRetro);

    // Registrar intento para gamificación en servidor
    try {
      await registrarIntento({
        actividad: "ahorcado",
        temaId: temaActual.id,
        puntaje,
        maximo: 10,
        errores,
        duracionSeg
      });
    } catch {
      // Manejo silencioso en caso de error de red
    }
  }
}

function deshabilitarTeclado() {
  tecladoEnPantalla.querySelectorAll("button").forEach((b) => (b.disabled = true));
}

// Soporte para teclado físico (A-Z, Ñ)
window.addEventListener("keydown", (e) => {
  if (juegoTerminado || !temaActual) return;
  // Ignorar atajos con Ctrl, Alt o Meta
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const tecla = e.key;
  if (/^[a-zA-ZñÑ]$/.test(tecla)) {
    e.preventDefault();
    procesarIntentoLetra(tecla.toUpperCase());
  }
});

btnOtraPalabra.addEventListener("click", async () => {
  // Si ya se usaron todos los términos disponibles, intentar traer nuevos con IA
  const pendientes = terminosDisponibles.filter((t) => !terminosUsados.has(t.id));
  if (pendientes.length === 0) {
    const nuevosGenerados = await generarPalabrasConIA({ silencioso: true });
    if (!nuevosGenerados) {
      terminosUsados.clear();
      iniciarPartida();
    }
  } else {
    iniciarPartida();
  }
});

if (btnGenerarIA) {
  btnGenerarIA.addEventListener("click", () => {
    generarPalabrasConIA({ silencioso: false });
  });
}

if (btnGenerarIAVacio) {
  btnGenerarIAVacio.addEventListener("click", () => {
    generarPalabrasConIA({ silencioso: false });
  });
}

await inicializar();

