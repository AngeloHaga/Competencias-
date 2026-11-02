// publico/js/modulos/tema.js · Visualizador del tema para estudiantes con recursos y avance
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { ACTIVIDADES } from "../nucleo/catalogo-actividades.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({ titulo: "Tema de aprendizaje", roles: ["estudiante", "docente", "admin"] });

const temaId = util.parametro("id");
if (!temaId) {
  ui.aviso("No se especificó ningún tema", "error");
  setTimeout(() => (window.location.href = "/paginas/asignaturas.html"), 1500);
}

// Elementos DOM
const sepAsignatura = document.getElementById("sepAsignatura");
const migaAsignatura = document.getElementById("migaAsignatura");
const sepUnidad = document.getElementById("sepUnidad");
const migaUnidad = document.getElementById("migaUnidad");
const migaTema = document.getElementById("migaTema");

const tituloTema = document.getElementById("tituloTema");
const badgeDificultad = document.getElementById("badgeDificultad");
const badgeEstadoRevisado = document.getElementById("badgeEstadoRevisado");
const btnMarcarRevisado = document.getElementById("btnMarcarRevisado");

const seccionObjetivos = document.getElementById("seccionObjetivos");
const listaObjetivos = document.getElementById("listaObjetivos");

const cuerpoResumen = document.getElementById("cuerpoResumen");

const seccionEjemplos = document.getElementById("seccionEjemplos");
const gridEjemplos = document.getElementById("gridEjemplos");

const seccionRecursos = document.getElementById("seccionRecursos");
const gridRecursos = document.getElementById("gridRecursos");

const contenedorActividades = document.getElementById("contenedorActividades");

let tema = null;
let unidad = null;
let asignatura = null;
let progreso = [];

async function inicializar() {
  ui.cargando(true);
  try {
    const [temaData, progresoData] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("progreso-temas")
    ]);

    tema = temaData;
    progreso = progresoData;

    // Guardar en localStorage último tema consultado
    try {
      localStorage.setItem("ultimoTema", JSON.stringify({ id: tema.id, titulo: tema.titulo }));
    } catch {
      // Ignorar fallo de almacenamiento local
    }

    // Obtener unidad y asignatura
    if (tema.unidadId) {
      try {
        unidad = await api.obtener("unidades", tema.unidadId);
        if (unidad?.asignaturaId) {
          asignatura = await api.obtener("asignaturas", unidad.asignaturaId);
        }
      } catch {
        // Información auxiliar no bloqueante
      }
    }

    renderizarMigas();
    renderizarCabecera();
    renderizarObjetivos();
    renderizarResumen();
    renderizarEjemplos();
    renderizarRecursos();
    renderizarActividades();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el tema", "error");
    tituloTema.textContent = "Error al cargar el tema";
  } finally {
    ui.cargando(false);
  }

  btnMarcarRevisado.addEventListener("click", marcarComoRevisado);
}

function renderizarMigas() {
  migaTema.textContent = tema.titulo || "Tema";

  if (asignatura) {
    migaAsignatura.textContent = asignatura.nombre;
    migaAsignatura.href = `/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}`;
    migaAsignatura.style.display = "inline";
    sepAsignatura.style.display = "inline";
  }

  if (unidad) {
    migaUnidad.textContent = unidad.titulo;
    migaUnidad.style.display = "inline";
    sepUnidad.style.display = "inline";
  }
}

function renderizarCabecera() {
  tituloTema.textContent = tema.titulo || "Sin título";

  if (tema.dificultad) {
    badgeDificultad.textContent = `Nivel ${tema.dificultad}`;
    badgeDificultad.style.display = "inline-flex";
  }

  actualizarEstadoRevisado();
}

function actualizarEstadoRevisado() {
  const yaRevisado = progreso.some((p) => p.temaId === tema.id);

  if (yaRevisado) {
    badgeEstadoRevisado.className = "insignia insignia--exito";
    badgeEstadoRevisado.textContent = "Revisado ✓";
    badgeEstadoRevisado.style.display = "inline-flex";

    btnMarcarRevisado.className = "btn btn--secundario";
    btnMarcarRevisado.textContent = "Revisado ✓";
    btnMarcarRevisado.disabled = true;
  } else {
    badgeEstadoRevisado.className = "insignia insignia--advertencia";
    badgeEstadoRevisado.textContent = "Pendiente";
    badgeEstadoRevisado.style.display = "inline-flex";

    btnMarcarRevisado.className = "btn btn--primario";
    btnMarcarRevisado.textContent = "Marcar como revisado";
    btnMarcarRevisado.disabled = false;
  }
}

async function marcarComoRevisado() {
  ui.cargando(true);
  btnMarcarRevisado.disabled = true;

  try {
    const nuevo = await api.crear("progreso-temas", { temaId: tema.id });
    progreso.push(nuevo);
    actualizarEstadoRevisado();
    ui.aviso("¡Excelente! Has marcado este tema como revisado", "exito");

    // P04.2: Registrar intento para sumar puntos e insignias de gamificación
    await registrarIntento({
      actividad: "tema-revisado",
      temaId: tema.id,
      puntaje: 1,
      maximo: 1
    }).catch(() => {});
  } catch (err) {
    ui.aviso(err.message || "Error al registrar el avance", "error");
    btnMarcarRevisado.disabled = false;
  } finally {
    ui.cargando(false);
  }
}

function renderizarObjetivos() {
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    listaObjetivos.innerHTML = tema.objetivos
      .map((obj) => `<li>${ui.escapar(obj)}</li>`)
      .join("");
    seccionObjetivos.style.display = "flex";
  } else {
    seccionObjetivos.style.display = "none";
  }
}

function renderizarResumen() {
  if (tema.resumen) {
    cuerpoResumen.innerHTML = util.formatoBasico(tema.resumen);
  } else {
    cuerpoResumen.innerHTML = `<p class="texto-suave">Este tema aún no incluye un resumen pedagógico.</p>`;
  }
}

function renderizarEjemplos() {
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    gridEjemplos.innerHTML = tema.ejemplos
      .map(
        (ej, idx) => `
        <article class="tarjeta-ejemplo">
          <span class="tarjeta-ejemplo__titulo">Ejemplo ${idx + 1}</span>
          <p class="tarjeta-ejemplo__texto">${ui.escapar(ej)}</p>
        </article>
      `
      )
      .join("");
    seccionEjemplos.style.display = "flex";
  } else {
    seccionEjemplos.style.display = "none";
  }
}

function obtenerEmbedVideo(url) {
  if (!url || typeof url !== "string") return null;

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

function renderizarRecursos() {
  if (!Array.isArray(tema.recursos) || tema.recursos.length === 0) {
    seccionRecursos.style.display = "none";
    return;
  }

  gridRecursos.innerHTML = tema.recursos
    .map((rec) => {
      const embedUrl = obtenerEmbedVideo(rec.url);
      const tituloRecurso = ui.escapar(rec.titulo || "Recurso complementario");

      if (embedUrl) {
        return `
          <div class="tarjeta-recurso-vista">
            <h3 class="tarjeta-recurso-vista__titulo">${tituloRecurso}</h3>
            <div class="recurso-video-wrapper">
              <iframe src="${embedUrl}" title="${tituloRecurso}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          </div>
        `;
      }

      if (rec.tipo === "pdf" || (rec.url && rec.url.toLowerCase().endsWith(".pdf"))) {
        return `
          <div class="tarjeta-recurso-vista">
            <h3 class="tarjeta-recurso-vista__titulo">${tituloRecurso}</h3>
            <p class="texto-suave texto-xs">Documento de lectura complementaria en formato PDF.</p>
            <div>
              <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno">
                📄 Abrir documento PDF
              </a>
            </div>
          </div>
        `;
      }

      if (rec.tipo === "imagen" || (rec.url && rec.url.match(/\.(jpg|jpeg|png|webp|gif)$/i))) {
        return `
          <div class="tarjeta-recurso-vista">
            <h3 class="tarjeta-recurso-vista__titulo">${tituloRecurso}</h3>
            <img src="${ui.escapar(rec.url)}" alt="${tituloRecurso}" class="recurso-imagen" loading="lazy">
          </div>
        `;
      }

      // Enlace web o lectura general
      return `
        <div class="tarjeta-recurso-vista">
          <h3 class="tarjeta-recurso-vista__titulo">${tituloRecurso}</h3>
          <div>
            <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--texto">
              🔗 Visitar recurso externo
            </a>
          </div>
        </div>
      `;
    })
    .join("");

  seccionRecursos.style.display = "flex";
}

function renderizarActividades() {
  if (!Array.isArray(ACTIVIDADES) || ACTIVIDADES.length === 0) {
    contenedorActividades.innerHTML = `
      <p class="texto-suave texto-sm">No hay actividades de práctica disponibles para este tema actualmente.</p>
    `;
    return;
  }

  contenedorActividades.innerHTML = ACTIVIDADES
    .map((act) => {
      const enlace = `${act.href}?temaId=${encodeURIComponent(tema.id)}`;

      return `
        <article class="tarjeta-actividad-item">
          <div>
            <h3 class="tarjeta-actividad-item__titulo">${ui.escapar(act.texto || act.titulo || "Actividad")}</h3>
            <p class="tarjeta-actividad-item__desc">${ui.escapar(act.descripcion || "")}</p>
          </div>
          <div>
            <a href="${enlace}" class="btn btn--primario btn--pequeno" style="width: 100%;">
              Comenzar →
            </a>
          </div>
        </article>
      `;
    })
    .join("");
}

await inicializar();
