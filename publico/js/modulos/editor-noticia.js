// publico/js/modulos/editor-noticia.js · Editor y creador de noticias para docentes y administradores
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({ titulo: "Editor de Noticia", roles: ["docente", "admin"] });

const idNoticia = util.parametro("id");
const esEdicion = !!idNoticia;

// Elementos DOM
const tituloPagina = document.getElementById("tituloPagina");
const formNoticia = document.getElementById("formNoticia");
const btnGuardarNoticia = document.getElementById("btnGuardarNoticia");
const btnAlternarVistaPrevia = document.getElementById("btnAlternarVistaPrevia");

const campoTitulo = document.getElementById("campoTitulo");
const errorTitulo = document.getElementById("errorTitulo");
const campoCategoria = document.getElementById("campoCategoria");
const campoTema = document.getElementById("campoTema");
const campoEstado = document.getElementById("campoEstado");
const campoDestacada = document.getElementById("campoDestacada");

const campoResumen = document.getElementById("campoResumen");
const contadorCaracteresResumen = document.getElementById("contadorCaracteresResumen");
const errorResumen = document.getElementById("errorResumen");

const campoImagen = document.getElementById("campoImagen");
const btnSubirImagen = document.getElementById("btnSubirImagen");
const inputArchivoImagen = document.getElementById("inputArchivoImagen");
const vistaPreviaImagenContenedor = document.getElementById("vistaPreviaImagenContenedor");
const imgVistaPrevia = document.getElementById("imgVistaPrevia");
const btnQuitarImagen = document.getElementById("btnQuitarImagen");

const campoCuerpo = document.getElementById("campoCuerpo");
const errorCuerpo = document.getElementById("errorCuerpo");

// Modal Vista Previa Completa
const modalVistaPreviaCompleta = document.getElementById("modalVistaPreviaCompleta");
const contenidoVistaPreviaModal = document.getElementById("contenidoVistaPreviaModal");
const btnCerrarVistaPrevia = document.getElementById("btnCerrarVistaPrevia");
const btnVolverEdicion = document.getElementById("btnVolverEdicion");

let temas = [];
let noticiaOriginal = null;

async function inicializar() {
  ui.cargando(true);
  try {
    const listaTemas = await api.listar("temas");
    temas = listaTemas;
    poblarSelectorTemas();

    if (esEdicion) {
      tituloPagina.textContent = "Editar Noticia";
      noticiaOriginal = await api.obtener("noticias", idNoticia);
      cargarDatosEnFormulario(noticiaOriginal);
    } else {
      tituloPagina.textContent = "Nueva Noticia";
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos", "error");
  } finally {
    ui.cargando(false);
  }

  configurarEventos();
}

function poblarSelectorTemas() {
  campoTema.innerHTML = '<option value="">Ninguno (noticia general)</option>';
  for (const t of temas) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.titulo || `Tema ${t.id}`;
    campoTema.appendChild(opt);
  }
}

function cargarDatosEnFormulario(n) {
  campoTitulo.value = n.titulo || "";
  campoCategoria.value = n.categoria || "Institucional";
  campoTema.value = n.temaId || "";
  campoEstado.value = n.estado || "borrador";
  campoDestacada.checked = !!n.destacada;
  campoResumen.value = n.resumen || "";
  campoImagen.value = n.imagen || "";
  campoCuerpo.value = n.cuerpo || "";

  actualizarContadorResumen();
  actualizarVistaPreviaImagen();
}

function configurarEventos() {
  campoResumen.addEventListener("input", actualizarContadorResumen);
  campoImagen.addEventListener("input", actualizarVistaPreviaImagen);

  btnSubirImagen.addEventListener("click", () => inputArchivoImagen.click());
  inputArchivoImagen.addEventListener("change", manejarSubidaImagen);
  btnQuitarImagen.addEventListener("click", quitarImagen);

  btnAlternarVistaPrevia.addEventListener("click", abrirVistaPrevia);
  btnCerrarVistaPrevia.addEventListener("click", cerrarVistaPrevia);
  btnVolverEdicion.addEventListener("click", cerrarVistaPrevia);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalVistaPreviaCompleta.style.display !== "none") {
      cerrarVistaPrevia();
    }
  });

  formNoticia.addEventListener("submit", guardarNoticia);
}

function actualizarContadorResumen() {
  const len = campoResumen.value.length;
  contadorCaracteresResumen.textContent = `${len} / 200 caracteres`;
  if (len > 200) {
    contadorCaracteresResumen.style.color = "var(--color-error)";
  } else {
    contadorCaracteresResumen.style.color = "var(--color-texto-suave)";
  }
}

function actualizarVistaPreviaImagen() {
  const url = campoImagen.value.trim();
  if (url) {
    imgVistaPrevia.src = url;
    vistaPreviaImagenContenedor.style.display = "inline-flex";
  } else {
    imgVistaPrevia.src = "";
    vistaPreviaImagenContenedor.style.display = "none";
  }
}

async function manejarSubidaImagen(e) {
  const archivo = e.target.files?.[0];
  if (!archivo) return;

  ui.cargando(true);
  try {
    const respuesta = await api.subir(archivo);
    if (respuesta?.url) {
      campoImagen.value = respuesta.url;
      actualizarVistaPreviaImagen();
      ui.aviso("Imagen subida con éxito", "exito");
    }
  } catch (err) {
    ui.aviso(err.message || "Error al subir la imagen", "error");
  } finally {
    ui.cargando(false);
    inputArchivoImagen.value = "";
  }
}

function quitarImagen() {
  campoImagen.value = "";
  actualizarVistaPreviaImagen();
}

function abrirVistaPrevia() {
  const titulo = campoTitulo.value.trim() || "Título de la noticia";
  const categoria = campoCategoria.value;
  const destacada = campoDestacada.checked;
  const imagen = campoImagen.value.trim();
  const resumen = campoResumen.value.trim();
  const cuerpo = campoCuerpo.value.trim();

  const temaSel = temas.find((t) => t.id === campoTema.value);
  const temaNombre = temaSel ? temaSel.titulo : null;

  contenidoVistaPreviaModal.innerHTML = `
    <article class="pila">
      <div style="display: flex; gap: var(--espacio-xs); align-items: center; flex-wrap: wrap;">
        <span class="insignia insignia--secundario">${ui.escapar(categoria)}</span>
        ${destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ""}
        ${temaNombre ? `<span class="insignia insignia--primario">${ui.escapar(temaNombre)}</span>` : ""}
        <span class="texto-xs texto-suave">Fecha: ${util.fechaLarga(new Date().toISOString())}</span>
      </div>

      <h1 class="texto-2xl" style="font-weight: var(--peso-extranegrita); color: var(--color-primario); margin: 0;">
        ${ui.escapar(titulo)}
      </h1>

      ${
        imagen
          ? `<img src="${ui.escapar(imagen)}" alt="${ui.escapar(titulo)}" style="max-width: 100%; border-radius: var(--radio-m); max-height: 320px; object-fit: cover;">`
          : ""
      }

      <div class="alerta alerta--info" style="font-style: italic;">
        ${ui.escapar(resumen || "Resumen no especificado")}
      </div>

      <div class="cuerpo-vista-previa">
        ${util.formatoBasico(cuerpo) || "<p class='texto-suave'>Sin contenido en el cuerpo de la noticia.</p>"}
      </div>
    </article>
  `;

  modalVistaPreviaCompleta.style.display = "flex";
}

function cerrarVistaPrevia() {
  modalVistaPreviaCompleta.style.display = "none";
}

async function guardarNoticia(e) {
  e.preventDefault();

  const titulo = campoTitulo.value.trim();
  const resumen = campoResumen.value.trim();
  const cuerpo = campoCuerpo.value.trim();
  const categoria = campoCategoria.value;
  const temaId = campoTema.value || null;
  const estado = campoEstado.value;
  const destacada = campoDestacada.checked;
  const imagen = campoImagen.value.trim() || null;

  let hayErrores = false;

  if (!titulo) {
    errorTitulo.textContent = "El título de la noticia es obligatorio.";
    errorTitulo.style.display = "block";
    hayErrores = true;
  } else {
    errorTitulo.style.display = "none";
  }

  if (!resumen) {
    errorResumen.textContent = "El resumen es obligatorio.";
    errorResumen.style.display = "block";
    hayErrores = true;
  } else if (resumen.length > 200) {
    errorResumen.textContent = `El resumen no debe superar los 200 caracteres (actual: ${resumen.length}).`;
    errorResumen.style.display = "block";
    hayErrores = true;
  } else {
    errorResumen.style.display = "none";
  }

  if (!cuerpo) {
    errorCuerpo.textContent = "El cuerpo de la noticia es obligatorio.";
    errorCuerpo.style.display = "block";
    hayErrores = true;
  } else {
    errorCuerpo.style.display = "none";
  }

  if (hayErrores) return;

  const datos = {
    titulo,
    categoria,
    temaId,
    destacada,
    estado,
    resumen,
    imagen,
    cuerpo
  };

  ui.cargando(true);
  btnGuardarNoticia.disabled = true;

  try {
    if (esEdicion) {
      await api.actualizar("noticias", idNoticia, datos);
      ui.aviso("Noticia actualizada con éxito", "exito");
    } else {
      await api.crear("noticias", datos);
      ui.aviso("Noticia creada con éxito", "exito");
    }

    setTimeout(() => {
      window.location.href = "/paginas/noticias.html";
    }, 1000);
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la noticia", "error");
    btnGuardarNoticia.disabled = false;
  } finally {
    ui.cargando(false);
  }
}

await inicializar();
