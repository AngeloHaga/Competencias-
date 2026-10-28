// publico/js/modulos/quiz.js · Cuestionario formativo por niveles cognitivos de Bloom
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { mostrarLogros } from "../nucleo/gamificacion.js";
import { generarDiploma } from "../nucleo/pdf.js";

await montarPlantilla({ titulo: "Quiz por Niveles", roles: ["estudiante"] });

// Referencias a elementos del DOM
const temaActivoTitulo = document.getElementById("tema-activo-titulo");
const btnCambiarTema = document.getElementById("btn-cambiar-tema");

const seccionNiveles = document.getElementById("seccion-niveles");
const contenedorNiveles = document.getElementById("contenedor-niveles");

const seccionCuestionario = document.getElementById("seccion-cuestionario");
const cuestionarioNivelNombre = document.getElementById("cuestionario-nivel-nombre");
const cuestionarioContador = document.getElementById("cuestionario-contador");
const barraProgresoRelleno = document.getElementById("barra-progreso-relleno");
const btnAbandonarQuiz = document.getElementById("btn-abandonar-quiz");
const tipoReactivoBadge = document.getElementById("tipo-reactivo-badge");
const preguntaEnunciado = document.getElementById("pregunta-enunciado");
const formRespuesta = document.getElementById("form-respuesta");
const contenedorOpciones = document.getElementById("contenedor-opciones");
const btnResponder = document.getElementById("btn-responder");
const btnSiguiente = document.getElementById("btn-siguiente");

const seccionResultados = document.getElementById("seccion-resultados");
const resultadoIcono = document.getElementById("resultado-icono");
const resultadoTitulo = document.getElementById("resultado-titulo");
const resultadoMensaje = document.getElementById("resultado-mensaje");
const resPorcentaje = document.getElementById("res-porcentaje");
const resAciertos = document.getElementById("res-aciertos");
const resErrores = document.getElementById("res-errores");
const bloqueRepasar = document.getElementById("bloque-repasar");
const listaRepasar = document.getElementById("lista-repasar");
const btnDescargarDiploma = document.getElementById("btn-descargar-diploma");
const btnReintentar = document.getElementById("btn-reintentar");
const btnVolverNiveles = document.getElementById("btn-volver-niveles");

// Estado de la sesión actual
let temaActivo = null;
let sesionId = null;
let nivelActual = 1;
let preguntasSesion = [];
let indicePregunta = 0;
let respondida = false;

const ICONOS_NIVEL = {
  1: "🔹",
  2: "🔷",
  3: "⭐",
  4: "🌟",
  5: "🏆"
};

// Cargar estado de los niveles del tema activo
async function cargarEstadoNiveles() {
  if (!temaActivo) return;
  ui.cargando(true);
  try {
    const res = await api.llamar("GET", `/api/quiz/estado?temaId=${encodeURIComponent(temaActivo.id)}`);
    const niveles = res.niveles || [];
    renderizarNiveles(niveles);
  } catch (err) {
    ui.aviso(err.message || "Error al consultar estado del quiz", "error");
  } finally {
    ui.cargando(false);
  }
}

function renderizarNiveles(niveles) {
  contenedorNiveles.innerHTML = "";

  niveles.forEach((item) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = `tarjeta-nivel tarjeta-nivel--${item.estado}`;

    const icono = ICONOS_NIVEL[item.nivel] || "🎯";

    let etiquetaEstado = "";
    if (item.estado === "aprobado") {
      etiquetaEstado = '<span class="insignia insignia--exito">Aprobado</span>';
    } else if (item.estado === "disponible") {
      etiquetaEstado = '<span class="insignia insignia--primario">Disponible</span>';
    } else {
      etiquetaEstado = '<span class="insignia insignia--suave">Bloqueado 🔒</span>';
    }

    tarjeta.innerHTML = `
      <div>
        <div class="tarjeta-nivel__cabecera">
          <span class="tarjeta-nivel__icono" aria-hidden="true">${icono}</span>
          ${etiquetaEstado}
        </div>
        <h3 class="tarjeta-nivel__titulo">Nivel ${item.nivel} · ${ui.escapar(item.nombre)}</h3>
        <p class="tarjeta-nivel__meta">Objetivo: reactivos nivel ${ui.escapar(item.nombre)}</p>
        <div class="tarjeta-nivel__porcentaje">
          <span class="texto-suave">Mejor intento:</span>
          <span class="porcentaje-numero">${item.mejorPorcentaje}%</span>
        </div>
      </div>
      <div class="tarjeta-nivel__pie" style="display: flex; gap: var(--espacio-sm); flex-wrap: wrap;"></div>
    `;

    const pie = tarjeta.querySelector(".tarjeta-nivel__pie");

    if (item.estado === "bloqueado") {
      const btnBloqueado = document.createElement("button");
      btnBloqueado.type = "button";
      btnBloqueado.className = "btn btn--secundario";
      btnBloqueado.disabled = true;
      btnBloqueado.style.width = "100%";
      btnBloqueado.textContent = "Bloqueado";
      pie.appendChild(btnBloqueado);
    } else if (item.estado === "disponible") {
      const btnIniciar = document.createElement("button");
      btnIniciar.type = "button";
      btnIniciar.className = "btn btn--primario";
      btnIniciar.style.width = "100%";
      btnIniciar.textContent = "Iniciar nivel ▶";
      btnIniciar.addEventListener("click", () => iniciarQuiz(item.nivel, item.nombre));
      pie.appendChild(btnIniciar);
    } else if (item.estado === "aprobado") {
      const btnRepetir = document.createElement("button");
      btnRepetir.type = "button";
      btnRepetir.className = "btn btn--secundario";
      btnRepetir.style.flex = "1";
      btnRepetir.textContent = "Practicar 🔄";
      btnRepetir.addEventListener("click", () => iniciarQuiz(item.nivel, item.nombre));
      pie.appendChild(btnRepetir);

      const btnDiploma = document.createElement("button");
      btnDiploma.type = "button";
      btnDiploma.className = "btn btn--acento";
      btnDiploma.style.flex = "1";
      btnDiploma.textContent = "Diploma 🎓";
      btnDiploma.addEventListener("click", () => {
        generarDiploma({ tipo: "nivel-quiz", temaId: temaActivo.id, nivel: item.nivel });
      });
      pie.appendChild(btnDiploma);
    }

    contenedorNiveles.appendChild(tarjeta);
  });
}

// Iniciar un nivel del quiz
async function iniciarQuiz(nivel, nombreNivel = "") {
  ui.cargando(true);
  try {
    const res = await api.llamar("POST", "/api/quiz/iniciar", {
      temaId: temaActivo.id,
      nivel
    });

    sesionId = res.sesionId;
    nivelActual = nivel;
    preguntasSesion = res.preguntas || [];
    indicePregunta = 0;

    cuestionarioNivelNombre.textContent = `Nivel ${nivel} · ${nombreNivel || "Bloom"}`;

    seccionNiveles.classList.add("oculto");
    seccionResultados.classList.add("oculto");
    seccionCuestionario.classList.remove("oculto");

    mostrarPreguntaActual();
  } catch (err) {
    ui.aviso(err.message || "No se pudo iniciar el quiz", "error");
  } finally {
    ui.cargando(false);
  }
}

// Mostrar la pregunta actual de la sesión
function mostrarPreguntaActual() {
  if (indicePregunta >= preguntasSesion.length) {
    finalizarQuiz();
    return;
  }

  respondida = false;
  btnResponder.classList.remove("oculto");
  btnResponder.disabled = false;
  btnSiguiente.classList.add("oculto");

  const preg = preguntasSesion[indicePregunta];
  const total = preguntasSesion.length;

  cuestionarioContador.textContent = `Pregunta ${indicePregunta + 1} de ${total}`;
  const pct = Math.round((indicePregunta / total) * 100);
  barraProgresoRelleno.style.width = `${pct}%`;
  document.getElementById("barra-progreso-quiz")?.setAttribute("aria-valuenow", pct);

  // Tipo badge
  const nombresTipo = {
    opcion: "Opción Múltiple",
    vf: "Verdadero o Falso",
    completar: "Completar Espacio"
  };
  tipoReactivoBadge.textContent = nombresTipo[preg.tipo] || "Pregunta";

  preguntaEnunciado.textContent = preg.enunciado || "";
  contenedorOpciones.innerHTML = "";

  if (preg.tipo === "opcion") {
    const opciones = Array.isArray(preg.opciones) ? preg.opciones : [];
    opciones.forEach((opt, idx) => {
      const label = document.createElement("label");
      label.className = "opcion-radio-tarjeta";
      label.innerHTML = `
        <input type="radio" name="resp-quiz" value="${idx}" required>
        <span>${ui.escapar(opt)}</span>
      `;
      contenedorOpciones.appendChild(label);
    });
  } else if (preg.tipo === "vf") {
    const gridVf = document.createElement("div");
    gridVf.className = "opciones-vf-grid";

    gridVf.innerHTML = `
      <label class="opcion-vf-tarjeta">
        <input type="radio" name="resp-quiz" value="true" required>
        <span aria-hidden="true">✅</span>
        <span>Verdadero</span>
      </label>
      <label class="opcion-vf-tarjeta">
        <input type="radio" name="resp-quiz" value="false" required>
        <span aria-hidden="true">❌</span>
        <span>Falso</span>
      </label>
    `;
    contenedorOpciones.appendChild(gridVf);
  } else if (preg.tipo === "completar") {
    const campo = document.createElement("div");
    campo.className = "campo";
    campo.innerHTML = `
      <label for="input-completar-resp" class="etiqueta">Escribe la respuesta correcta:</label>
      <input type="text" id="input-completar-resp" class="entrada" required placeholder="Palabra o frase clave..." autocomplete="off">
    `;
    contenedorOpciones.appendChild(campo);

    setTimeout(() => {
      document.getElementById("input-completar-resp")?.focus();
    }, 50);
  }
}

// Envío de respuesta a la pregunta actual
formRespuesta.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (respondida) return;

  const preg = preguntasSesion[indicePregunta];
  let valorRespuesta = null;

  if (preg.tipo === "opcion" || preg.tipo === "vf") {
    const seleccionado = formRespuesta.querySelector('input[name="resp-quiz"]:checked');
    if (!seleccionado) {
      ui.aviso("Por favor selecciona una opción", "advertencia");
      return;
    }
    valorRespuesta = preg.tipo === "vf" ? seleccionado.value === "true" : Number(seleccionado.value);
  } else if (preg.tipo === "completar") {
    const input = document.getElementById("input-completar-resp");
    if (!input || !input.value.trim()) {
      ui.aviso("Por favor escribe tu respuesta", "advertencia");
      return;
    }
    valorRespuesta = input.value.trim();
  }

  ui.cargando(true);
  try {
    const res = await api.llamar("POST", "/api/quiz/responder", {
      sesionId,
      preguntaId: preg.id,
      respuesta: valorRespuesta
    });

    respondida = true;
    btnResponder.classList.add("oculto");
    btnSiguiente.classList.remove("oculto");

    // Deshabilitar inputs de la pregunta respondida
    formRespuesta.querySelectorAll("input").forEach((inp) => (inp.disabled = true));

    // Mostrar retroalimentación con retroalimentacion.js
    await mostrarRetro({
      correcto: res.correcto,
      explicacion: res.retroalimentacion || "",
      sugerencia: !res.correcto ? `Respuesta correcta: ${res.correcta}` : "",
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActivo.id)}`
    });
  } catch (err) {
    ui.aviso(err.message || "Error al registrar respuesta", "error");
  } finally {
    ui.cargando(false);
  }
});

btnSiguiente.addEventListener("click", () => {
  indicePregunta++;
  if (indicePregunta < preguntasSesion.length) {
    mostrarPreguntaActual();
  } else {
    finalizarQuiz();
  }
});

// Finalizar la sesión de quiz
async function finalizarQuiz() {
  ui.cargando(true);
  try {
    const resultado = await api.llamar("POST", "/api/quiz/finalizar", {
      sesionId
    });

    seccionCuestionario.classList.add("oculto");
    seccionResultados.classList.remove("oculto");

    resPorcentaje.textContent = `${resultado.porcentaje}%`;
    resAciertos.textContent = resultado.aciertos;
    resErrores.textContent = resultado.errores;

    // Mostrar resumen pedagógico con mostrarResumen()
    const accionResumen = await mostrarResumen({
      titulo: resultado.aprobado ? "¡Nivel Aprobado!" : "Nivel No Superado",
      aciertos: resultado.aciertos,
      errores: resultado.errores,
      recomendaciones: resultado.repasar || [],
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActivo.id)}`
    });

    // Bloque de recomendaciones en la vista principal
    if (Array.isArray(resultado.repasar) && resultado.repasar.length > 0) {
      listaRepasar.innerHTML = "";
      resultado.repasar.forEach((txt) => {
        const li = document.createElement("li");
        li.textContent = txt;
        listaRepasar.appendChild(li);
      });
      bloqueRepasar.classList.remove("oculto");
    } else {
      bloqueRepasar.classList.add("oculto");
    }

    if (resultado.aprobado) {
      resultadoIcono.textContent = "🏆";
      resultadoTitulo.textContent = "¡Felicitaciones, Nivel Aprobado!";
      resultadoMensaje.textContent = "Has superado la exigencia pedagógica del nivel.";
      btnDescargarDiploma.classList.remove("oculto");
      btnReintentar.classList.add("oculto");

      // Celebración de logros e insignias
      mostrarLogros(resultado);
    } else {
      resultadoIcono.textContent = "📚";
      resultadoTitulo.textContent = "Nivel No Superado";
      resultadoMensaje.textContent = "Necesitas al menos 70% para aprobar. Puedes reintentar con preguntas nuevas.";
      btnDescargarDiploma.classList.add("oculto");
      btnReintentar.classList.remove("oculto");
    }

    if (accionResumen === "repetir") {
      iniciarQuiz(nivelActual);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al finalizar el quiz", "error");
    seccionCuestionario.classList.add("oculto");
    seccionNiveles.classList.remove("oculto");
  } finally {
    ui.cargando(false);
  }
}

// Botones de la sección de resultados
btnDescargarDiploma.addEventListener("click", () => {
  generarDiploma({
    tipo: "nivel-quiz",
    temaId: temaActivo.id,
    nivel: nivelActual
  });
});

btnReintentar.addEventListener("click", () => {
  iniciarQuiz(nivelActual);
});

btnVolverNiveles.addEventListener("click", () => {
  seccionResultados.classList.add("oculto");
  seccionNiveles.classList.remove("oculto");
  cargarEstadoNiveles();
});

btnAbandonarQuiz.addEventListener("click", () => {
  if (confirm("¿Estás seguro de que deseas salir del quiz? Tu progreso no guardado se perderá.")) {
    seccionCuestionario.classList.add("oculto");
    seccionNiveles.classList.remove("oculto");
    cargarEstadoNiveles();
  }
});

btnCambiarTema.addEventListener("click", async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete("temaId");
    window.history.replaceState({}, "", `${window.location.pathname}`);
    inicializar();
  } catch (err) {
    ui.aviso(err.message || "Error al cambiar de tema", "error");
  }
});

// Inicialización de la página
async function inicializar() {
  ui.cargando(true);
  try {
    temaActivo = await obtenerTemaActividad();
    if (!temaActivo) {
      temaActivoTitulo.textContent = "No se ha seleccionado ningún tema.";
      return;
    }

    temaActivoTitulo.textContent = `Tema: ${temaActivo.titulo}`;
    await cargarEstadoNiveles();
  } catch (err) {
    temaActivoTitulo.textContent = "Error al seleccionar el tema.";
  } finally {
    ui.cargando(false);
  }
}

inicializar();
