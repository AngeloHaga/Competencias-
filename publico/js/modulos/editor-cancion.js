// publico/js/modulos/editor-cancion.js · Editor de canciones educativas para docentes y administradores
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({ titulo: "Editor de Canción", roles: ["docente", "admin"] });

const idCancion = util.parametro("id");
const esEdicion = !!idCancion;

// Elementos DOM
const tituloPagina = document.getElementById("tituloPagina");
const formCancion = document.getElementById("formCancion");
const btnGuardarCancion = document.getElementById("btnGuardarCancion");

const campoTitulo = document.getElementById("campoTitulo");
const errorTitulo = document.getElementById("errorTitulo");

const campoTema = document.getElementById("campoTema");
const errorTema = document.getElementById("errorTema");

const campoAudio = document.getElementById("campoAudio");
const btnSubirAudio = document.getElementById("btnSubirAudio");
const inputArchivoAudio = document.getElementById("inputArchivoAudio");
const contenedorReproductorAudio = document.getElementById("contenedorReproductorAudio");
const audioPreview = document.getElementById("audioPreview");
const errorAudio = document.getElementById("errorAudio");

const campoAutoria = document.getElementById("campoAutoria");
const errorAutoria = document.getElementById("errorAutoria");

const campoLicencia = document.getElementById("campoLicencia");
const errorLicencia = document.getElementById("errorLicencia");
const contenedorLicenciaOtra = document.getElementById("contenedorLicenciaOtra");
const campoLicenciaOtra = document.getElementById("campoLicenciaOtra");
const errorLicenciaOtra = document.getElementById("errorLicenciaOtra");

const campoLetra = document.getElementById("campoLetra");
const errorLetra = document.getElementById("errorLetra");

const campoLRC = document.getElementById("campoLRC");
const btnEjemploLRC = document.getElementById("btnEjemploLRC");

let temas = [];

async function inicializar() {
  ui.cargando(true);
  try {
    temas = await api.listar("temas");
    poblarSelectorTemas();

    if (esEdicion) {
      tituloPagina.textContent = "Editar Canción Educativa";
      const cancion = await api.obtener("canciones", idCancion);
      cargarDatosEnFormulario(cancion);
    } else {
      tituloPagina.textContent = "Nueva Canción Educativa";
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos", "error");
  } finally {
    ui.cargando(false);
  }

  configurarEventos();
}

function poblarSelectorTemas() {
  campoTema.innerHTML = '<option value="" disabled selected>Selecciona un tema...</option>';
  for (const t of temas) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.titulo || `Tema ${t.id}`;
    campoTema.appendChild(opt);
  }
}

function cargarDatosEnFormulario(c) {
  campoTitulo.value = c.titulo || "";
  campoTema.value = c.temaId || "";
  campoAudio.value = c.audio || "";
  campoLetra.value = c.letra || "";
  campoLRC.value = c.lrc || "";
  campoAutoria.value = c.autoria || "";

  if (c.audio) {
    audioPreview.src = c.audio;
    contenedorReproductorAudio.style.display = "block";
  }

  // Licencia
  if (c.licencia) {
    if (c.licencia.startsWith("Otra:")) {
      campoLicencia.value = "Otra";
      contenedorLicenciaOtra.style.display = "flex";
      campoLicenciaOtra.value = c.licencia.replace(/^Otra:\s*/, "");
    } else {
      campoLicencia.value = c.licencia;
    }
  }
}

function configurarEventos() {
  btnSubirAudio.addEventListener("click", () => inputArchivoAudio.click());
  inputArchivoAudio.addEventListener("change", manejarSubidaAudio);

  campoAudio.addEventListener("input", () => {
    const url = campoAudio.value.trim();
    if (url) {
      audioPreview.src = url;
      contenedorReproductorAudio.style.display = "block";
    } else {
      contenedorReproductorAudio.style.display = "none";
    }
  });

  campoLicencia.addEventListener("change", () => {
    if (campoLicencia.value === "Otra") {
      contenedorLicenciaOtra.style.display = "flex";
      campoLicenciaOtra.focus();
    } else {
      contenedorLicenciaOtra.style.display = "none";
    }
  });

  btnEjemploLRC.addEventListener("click", () => {
    campoLRC.value = 
`[00:02.50] En el aula digital aprendemos a crear
[00:07.10] Con destreza y con sentido nos vamos a conectar
[00:12.80] Información y pensamiento crítico sin igual
[00:18.20] ¡Estrategias pedagógicas para transformar!`;
    ui.aviso("Ejemplo de letra LRC cargado", "info");
  });

  formCancion.addEventListener("submit", guardarCancion);
}

async function manejarSubidaAudio(e) {
  const archivo = e.target.files?.[0];
  if (!archivo) return;

  ui.cargando(true);
  try {
    const respuesta = await api.subir(archivo);
    if (respuesta?.url) {
      campoAudio.value = respuesta.url;
      audioPreview.src = respuesta.url;
      contenedorReproductorAudio.style.display = "block";
      ui.aviso("Audio MP3 subido con éxito", "exito");
    }
  } catch (err) {
    ui.aviso(err.message || "Error al subir el archivo de audio", "error");
  } finally {
    ui.cargando(false);
    inputArchivoAudio.value = "";
  }
}

async function guardarCancion(e) {
  e.preventDefault();

  const titulo = campoTitulo.value.trim();
  const temaId = campoTema.value;
  const audio = campoAudio.value.trim();
  const autoria = campoAutoria.value.trim();
  const tipoLicencia = campoLicencia.value;
  const letra = campoLetra.value.trim();
  const lrc = campoLRC.value.trim() || null;

  let hayErrores = false;

  if (!titulo) {
    errorTitulo.textContent = "El título es obligatorio.";
    errorTitulo.style.display = "block";
    hayErrores = true;
  } else {
    errorTitulo.style.display = "none";
  }

  if (!temaId) {
    errorTema.textContent = "Debes asociar la canción a un tema.";
    errorTema.style.display = "block";
    hayErrores = true;
  } else {
    errorTema.style.display = "none";
  }

  if (!audio) {
    errorAudio.textContent = "El archivo de audio MP3 es obligatorio.";
    errorAudio.style.display = "block";
    hayErrores = true;
  } else {
    errorAudio.style.display = "none";
  }

  if (!autoria) {
    errorAutoria.textContent = "La autoría o créditos son obligatorios.";
    errorAutoria.style.display = "block";
    hayErrores = true;
  } else {
    errorAutoria.style.display = "none";
  }

  let licenciaFinal = tipoLicencia;
  if (tipoLicencia === "Otra") {
    const descOtra = campoLicenciaOtra.value.trim();
    if (!descOtra) {
      errorLicenciaOtra.textContent = "Debes especificar la descripción de la licencia.";
      errorLicenciaOtra.style.display = "block";
      hayErrores = true;
    } else {
      errorLicenciaOtra.style.display = "none";
      licenciaFinal = `Otra: ${descOtra}`;
    }
  }

  if (!letra) {
    errorLetra.textContent = "La letra de la canción es obligatoria.";
    errorLetra.style.display = "block";
    hayErrores = true;
  } else {
    errorLetra.style.display = "none";
  }

  if (hayErrores) return;

  const datos = {
    titulo,
    temaId,
    audio,
    letra,
    lrc,
    autoria,
    licencia: licenciaFinal
  };

  ui.cargando(true);
  btnGuardarCancion.disabled = true;

  try {
    if (esEdicion) {
      await api.actualizar("canciones", idCancion, datos);
      ui.aviso("Canción actualizada con éxito", "exito");
    } else {
      await api.crear("canciones", datos);
      ui.aviso("Canción creada con éxito", "exito");
    }

    setTimeout(() => {
      window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
    }, 1000);
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la canción", "error");
    btnGuardarCancion.disabled = false;
  } finally {
    ui.cargando(false);
  }
}

await inicializar();
