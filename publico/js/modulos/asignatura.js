// publico/js/modulos/asignatura.js · Vista detallada de asignatura y Tutor Virtual Socrático con IA
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({ titulo: "Asignatura", roles: ["estudiante", "docente", "admin"] });

const asignaturaId = util.parametro("id");
if (!asignaturaId) {
  ui.aviso("No se especificó la asignatura a consultar", "error");
  setTimeout(() => (window.location.href = "/paginas/asignaturas.html"), 1500);
}

// Elementos del DOM de la página
const tituloAsignatura = document.getElementById("tituloAsignatura");
const descripcionAsignatura = document.getElementById("descripcionAsignatura");
const badgeNivel = document.getElementById("badgeNivel");
const boxAvanceGeneral = document.getElementById("boxAvanceGeneral");
const textoProgresoGlobal = document.getElementById("textoProgresoGlobal");
const fillProgresoGlobal = document.getElementById("fillProgresoGlobal");
const contenedorUnidades = document.getElementById("contenedorUnidades");
const heroSugerencias = document.getElementById("heroSugerencias");
const btnAbrirTutorHero = document.getElementById("btnAbrirTutorHero");

// Elementos del DOM del Tutor Socrático
const btnAbrirTutorFlotante = document.getElementById("btnAbrirTutorFlotante");
const panelTutorChat = document.getElementById("panelTutorChat");
const btnCerrarTutor = document.getElementById("btnCerrarTutor");
const btnReiniciarTutor = document.getElementById("btnReiniciarTutor");
const tutorSubtextoAsignatura = document.getElementById("tutorSubtextoAsignatura");
const tutorMensajesContenedor = document.getElementById("tutorMensajesContenedor");
const tutorIndicadorPensando = document.getElementById("tutorIndicadorPensando");
const tutorPildorasContenedor = document.getElementById("tutorPildorasContenedor");
const formTutorChat = document.getElementById("formTutorChat");
const inputMensajeTutor = document.getElementById("inputMensajeTutor");
const btnEnviarMensajeTutor = document.getElementById("btnEnviarMensajeTutor");

const CLAVE_SESION_TUTOR = `tutor_chat_${asignaturaId}`;
let asignaturaActual = null;
let temasDisponibles = [];
let historialChat = [];
let estaPensando = false;

/**
 * Carga la información de la asignatura, unidades, temas y progreso
 */
async function cargarContenido() {
  ui.cargando(true);
  try {
    const [asignatura, todasUnidades, todosTemas, progreso] = await Promise.all([
      api.obtener("asignaturas", asignaturaId),
      api.listar("unidades", { asignaturaId }),
      api.listar("temas"),
      api.listar("progreso-temas")
    ]);

    asignaturaActual = asignatura;
    tutorSubtextoAsignatura.textContent = asignatura.nombre || "Asignatura";

    // Cabecera
    tituloAsignatura.textContent = asignatura.nombre || "Asignatura";
    descripcionAsignatura.textContent = asignatura.descripcion || "";
    if (asignatura.nivel) {
      badgeNivel.textContent = asignatura.nivel;
      badgeNivel.style.display = "inline-flex";
    } else {
      badgeNivel.style.display = "none";
    }

    // Filtrar unidades visibles y ordenar
    const unidades = todasUnidades
      .filter((u) => u.visible !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    if (unidades.length === 0) {
      contenedorUnidades.innerHTML = `
        <div class="tarjeta texto-centro">
          <p>Esta asignatura aún no cuenta con unidades didácticas disponibles.</p>
        </div>
      `;
      inicializarTutorChat([]);
      return;
    }

    const idsProgreso = new Set(progreso.map((p) => p.temaId));

    // Calcular avance global de la asignatura
    const idsUnidades = new Set(unidades.map((u) => u.id));
    const temasDelCurso = todosTemas.filter(
      (t) => idsUnidades.has(t.unidadId) && t.estado === "publicado"
    );
    temasDisponibles = temasDelCurso;

    const totalTemas = temasDelCurso.length;
    const totalRevisados = temasDelCurso.filter((t) => idsProgreso.has(t.id)).length;
    const porcentajeGlobal = totalTemas > 0 ? Math.round((totalRevisados / totalTemas) * 100) : 0;

    boxAvanceGeneral.style.display = "flex";
    textoProgresoGlobal.textContent = `Avance: ${porcentajeGlobal}% (${totalRevisados}/${totalTemas})`;
    fillProgresoGlobal.style.width = `${porcentajeGlobal}%`;

    // Renderizar cada unidad con sus temas
    contenedorUnidades.innerHTML = unidades
      .map((unidad) => {
        const temasUnidad = todosTemas
          .filter((t) => t.unidadId === unidad.id && t.estado === "publicado")
          .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

        let listaTemasHtml = "";
        if (temasUnidad.length === 0) {
          listaTemasHtml = `<p class="texto-suave texto-xs" style="padding: var(--espacio-s) 0;">No hay temas publicados en esta unidad.</p>`;
        } else {
          listaTemasHtml = `
            <div class="lista-temas-curso">
              ${temasUnidad
                .map((tema, index) => {
                  const revisado = idsProgreso.has(tema.id);

                  return `
                    <article class="tarjeta-tema-item">
                      <div class="tarjeta-tema-item__izq">
                        <span class="tarjeta-tema-item__numero">${index + 1}</span>
                        <div>
                          <h3 class="tarjeta-tema-item__titulo">${ui.escapar(tema.titulo || "Tema sin título")}</h3>
                          ${
                            tema.dificultad
                              ? `<span class="texto-suave texto-xs">Nivel ${ui.escapar(tema.dificultad)}</span>`
                              : ""
                          }
                        </div>
                      </div>

                      <div class="tarjeta-tema-item__der">
                        <button type="button" class="btn-consultar-tutor-tema" data-tema-id="${encodeURIComponent(tema.id)}" data-tema-titulo="${encodeURIComponent(tema.titulo || '')}">
                          💡 Preguntar al tutor
                        </button>
                        <span class="insignia ${revisado ? "insignia--revisado" : "insignia--pendiente"}">
                          ${revisado ? "Revisado ✓" : "Pendiente"}
                        </span>
                        <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno">
                          Estudiar tema →
                        </a>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `;
        }

        return `
          <section class="bloque-unidad">
            <header class="bloque-unidad__cabecera">
              <h2 class="bloque-unidad__titulo">${ui.escapar(unidad.titulo || "Unidad")}</h2>
              <span class="texto-suave texto-xs">${temasUnidad.length} ${temasUnidad.length === 1 ? "tema" : "temas"}</span>
            </header>

            ${listaTemasHtml}
          </section>
        `;
      })
      .join("");

    // Conectar botones de consultar tutor en cada tema
    document.querySelectorAll(".btn-consultar-tutor-tema").forEach((btn) => {
      btn.addEventListener("click", () => {
        const temaTitulo = decodeURIComponent(btn.dataset.temaTitulo || "este tema");
        abrirTutorChat();
        enviarMensajeUsuario(`Hola tutor, ¿qué pregunta orientadora o pista me das para reflexionar sobre: "${temaTitulo}"?`);
      });
    });

    inicializarTutorChat(temasDelCurso);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el contenido de la asignatura", "error");
    contenedorUnidades.innerHTML = `<div class="tarjeta texto-centro">No se pudo cargar la asignatura.</div>`;
  } finally {
    ui.cargando(false);
  }
}

/**
 * Inicializa la lógica del Tutor Virtual Socrático
 * @param {Array} temas
 */
function inicializarTutorChat(temas) {
  // Generar sugerencias dinámicas basadas en los temas de la asignatura
  const sugerencias = [
    "¿Qué estudiaremos en esta asignatura?",
    "¿Cómo prepararme para las evaluaciones?",
    "¿Qué errores comunes debo evitar?"
  ];

  if (temas.length > 0) {
    sugerencias.unshift(`💡 Pista sobre: ${temas[0].titulo}`);
    if (temas.length > 1) {
      sugerencias.push(`¿Cómo se relaciona "${temas[0].titulo}" con "${temas[1].titulo}"?`);
    }
  }

  // Renderizar sugerencias en la tarjeta Hero
  heroSugerencias.innerHTML = sugerencias
    .slice(0, 3)
    .map(
      (sug) => `
      <button type="button" class="tutor-chip-sugerencia btn-sugerencia-hero" data-pregunta="${ui.escapar(sug)}">
        ${ui.escapar(sug)}
      </button>
    `
    )
    .join("");

  document.querySelectorAll(".btn-sugerencia-hero").forEach((btn) => {
    btn.addEventListener("click", () => {
      abrirTutorChat();
      enviarMensajeUsuario(btn.dataset.pregunta);
    });
  });

  // Renderizar sugerencias en el panel del chat
  renderizarPildorasChat(sugerencias);

  // Cargar historial de la sesión actual
  restaurarHistorial();

  // Conectar eventos de controles del chat
  btnAbrirTutorHero.addEventListener("click", () => abrirTutorChat());
  btnAbrirTutorFlotante.addEventListener("click", () => alternarTutorChat());
  btnCerrarTutor.addEventListener("click", () => cerrarTutorChat());

  btnReiniciarTutor.addEventListener("click", () => {
    if (confirm("¿Deseas reiniciar la sesión de diálogo con el tutor socrático?")) {
      reiniciarConversacion();
    }
  });

  formTutorChat.addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = inputMensajeTutor.value.trim();
    if (!texto || estaPensando) return;
    inputMensajeTutor.value = "";
    inputMensajeTutor.style.height = "auto";
    enviarMensajeUsuario(texto);
  });

  // Autoajuste de altura de textarea y envío con Enter
  inputMensajeTutor.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formTutorChat.dispatchEvent(new Event("submit"));
    }
  });

  inputMensajeTutor.addEventListener("input", () => {
    inputMensajeTutor.style.height = "auto";
    inputMensajeTutor.style.height = Math.min(inputMensajeTutor.scrollHeight, 100) + "px";
  });

  // Cerrar chat con Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panelTutorChat.classList.contains("tutor-chat-panel--oculto")) {
      cerrarTutorChat();
    }
  });
}

function abrirTutorChat() {
  panelTutorChat.classList.remove("tutor-chat-panel--oculto");
  btnAbrirTutorFlotante.style.display = "none";
  desplazarAlFondo();
  setTimeout(() => inputMensajeTutor.focus(), 150);
}

function cerrarTutorChat() {
  panelTutorChat.classList.add("tutor-chat-panel--oculto");
  btnAbrirTutorFlotante.style.display = "flex";
}

function alternarTutorChat() {
  if (panelTutorChat.classList.contains("tutor-chat-panel--oculto")) {
    abrirTutorChat();
  } else {
    cerrarTutorChat();
  }
}

function renderizarPildorasChat(lista) {
  tutorPildorasContenedor.innerHTML = lista
    .map(
      (sug) => `
      <button type="button" class="tutor-chip-sugerencia btn-pildora-chat" data-pregunta="${ui.escapar(sug)}">
        ${ui.escapar(sug)}
      </button>
    `
    )
    .join("");

  tutorPildorasContenedor.querySelectorAll(".btn-pildora-chat").forEach((btn) => {
    btn.addEventListener("click", () => {
      enviarMensajeUsuario(btn.dataset.pregunta);
    });
  });
}

/**
 * Restaura el historial de chat desde sessionStorage o crea el mensaje inicial
 */
function restaurarHistorial() {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION_TUTOR);
    if (raw) {
      historialChat = JSON.parse(raw);
    }
  } catch {
    historialChat = [];
  }

  tutorMensajesContenedor.innerHTML = "";

  if (!historialChat || historialChat.length === 0) {
    const saludoInicial = {
      rol: "tutor",
      texto: `¡Hola! 👋 Soy tu Tutor Virtual Socrático de **${asignaturaActual?.nombre || "esta asignatura"}**.\n\nEstoy aquí para acompañarte a razonar y dominar los contenidos curriculares de esta materia. No te daré las respuestas directas, sino que te ayudaré a construir el conocimiento paso a paso mediante pistas, preguntas reflexivas y análisis guiado.\n\n¿Sobre qué tema o concepto deseas reflexionar hoy?`,
      hora: formatoHora(new Date())
    };
    historialChat = [saludoInicial];
    guardarHistorial();
  }

  historialChat.forEach((msg) => renderizarBurbuja(msg));
  desplazarAlFondo();
}

/**
 * Reinicia la conversación del tutor
 */
function reiniciarConversacion() {
  sessionStorage.removeItem(CLAVE_SESION_TUTOR);
  historialChat = [];
  restaurarHistorial();
  ui.aviso("Conversación reiniciada. ¡Comencemos de nuevo!", "exito");
}

function guardarHistorial() {
  try {
    sessionStorage.setItem(CLAVE_SESION_TUTOR, JSON.stringify(historialChat));
  } catch {}
}

function formatoHora(fecha) {
  const f = new Date(fecha);
  return f.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Renderiza una burbuja de mensaje en el contenedor
 * @param {Object} msg { rol, texto, hora }
 */
function renderizarBurbuja(msg) {
  const esEstudiante = msg.rol === "estudiante" || msg.rol === "usuario";
  const div = document.createElement("div");
  div.className = `tutor-msg ${esEstudiante ? "tutor-msg--estudiante" : "tutor-msg--tutor"}`;

  const avatar = esEstudiante ? "👤" : "🎓";
  const contenidoHtml = util.formatoBasico(msg.texto);

  div.innerHTML = `
    <div class="tutor-msg__avatar" aria-hidden="true">${avatar}</div>
    <div class="tutor-msg__contenido">
      <div class="tutor-msg__burbuja">${contenidoHtml}</div>
      <span class="tutor-msg__hora">${msg.hora || formatoHora(new Date())}</span>
    </div>
  `;

  tutorMensajesContenedor.appendChild(div);
}

function desplazarAlFondo() {
  requestAnimationFrame(() => {
    tutorMensajesContenedor.scrollTop = tutorMensajesContenedor.scrollHeight;
  });
}

/**
 * Envía la consulta del estudiante al backend y gestiona la respuesta socrática
 * @param {string} texto
 */
async function enviarMensajeUsuario(texto) {
  if (!texto || estaPensando) return;

  const horaActual = formatoHora(new Date());

  // 1. Añadir y renderizar mensaje del estudiante
  const msgUsuario = {
    rol: "estudiante",
    texto,
    hora: horaActual
  };
  historialChat.push(msgUsuario);
  renderizarBurbuja(msgUsuario);
  guardarHistorial();
  desplazarAlFondo();

  // 2. Estado de razonamiento
  estaPensando = true;
  tutorIndicadorPensando.style.display = "flex";
  btnEnviarMensajeTutor.disabled = true;
  inputMensajeTutor.disabled = true;
  desplazarAlFondo();

  try {
    // Preparar historial previo formateado para la API
    const historialPrevio = historialChat.slice(0, -1).map((h) => ({
      rol: h.rol === "estudiante" ? "usuario" : "modelo",
      texto: h.texto
    }));

    const res = await api.ia("tutor", {
      asignaturaId,
      mensaje: texto,
      historial: historialPrevio
    });

    const respuestaTexto = res.respuesta || res.texto || "Continuemos reflexionando sobre este tema.";

    const msgTutor = {
      rol: "tutor",
      texto: respuestaTexto,
      hora: formatoHora(new Date())
    };

    historialChat.push(msgTutor);
    renderizarBurbuja(msgTutor);
    guardarHistorial();

    // Actualizar píldoras con sugerencias contextuales
    actualizarPildorasContextuales(texto);
  } catch (err) {
    const errorMsg = {
      rol: "tutor",
      texto: `⚠️ No pude procesar tu consulta en este momento: ${err.message || "Error de conexión"}. Por favor intenta nuevamente.`,
      hora: formatoHora(new Date())
    };
    historialChat.push(errorMsg);
    renderizarBurbuja(errorMsg);
  } finally {
    estaPensando = false;
    tutorIndicadorPensando.style.display = "none";
    btnEnviarMensajeTutor.disabled = false;
    inputMensajeTutor.disabled = false;
    inputMensajeTutor.focus();
    desplazarAlFondo();
  }
}

/**
 * Actualiza las píldoras de preguntas guiadas según la interacción
 */
function actualizarPildorasContextuales(ultimoMensaje) {
  const nuevasSugerencias = [
    "¿Podrías darme una analogía sencilla?",
    "¿Qué consecuencia práctica tiene esto?",
    "¿Cuál es el siguiente paso en este concepto?"
  ];

  if (temasDisponibles.length > 0) {
    const otroTema = temasDisponibles.find((t) => !ultimoMensaje.toLowerCase().includes(t.titulo.toLowerCase()));
    if (otroTema) {
      nuevasSugerencias.unshift(`💡 ¿Cómo se aplica en "${otroTema.titulo}"?`);
    }
  }

  renderizarPildorasChat(nuevasSugerencias);
}

// Carga inicial
await cargarContenido();
