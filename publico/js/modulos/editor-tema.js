// publico/js/modulos/editor-tema.js · Gestión de la ficha pedagógica y glosario curricular
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({ titulo: "Ficha del Tema", roles: ["docente", "admin"] });

// Parámetros y elementos generales
const temaId = util.parametro("id");
if (!temaId) {
  ui.aviso("No se especificó ningún identificador de tema", "error");
  setTimeout(() => (window.location.href = "/paginas/editor-contenidos.html"), 1500);
}

// Elementos de cabecera y navegación
const enlaceVolver = document.getElementById("enlaceVolver");
const encabezadoTituloTema = document.getElementById("encabezadoTituloTema");
const encabezadoSubtitulo = document.getElementById("encabezadoSubtitulo");
const btnGuardarTema = document.getElementById("btnGuardarTema");
const btnGenerarIA = document.getElementById("btn-generar-ia");

// Pestañas
const tabBtnFicha = document.getElementById("tabBtnFicha");
const tabBtnGlosario = document.getElementById("tabBtnGlosario");
const panelFicha = document.getElementById("panelFicha");
const panelGlosario = document.getElementById("panelGlosario");
const badgeContadorGlosario = document.getElementById("badgeContadorGlosario");

// Campos del formulario de Ficha
const formFichaTema = document.getElementById("formFichaTema");
const campoTitulo = document.getElementById("campoTitulo");
const campoEstado = document.getElementById("campoEstado");
const campoDificultad = document.getElementById("campoDificultad");
const campoPalabrasClave = document.getElementById("campoPalabrasClave");
const campoFuentes = document.getElementById("campoFuentes");
const campoResumen = document.getElementById("campoResumen");
const contadorPalabrasResumen = document.getElementById("contadorPalabrasResumen");
const contenedorContadorPalabras = document.getElementById("contenedorContadorPalabras");
const btnAlternarVistaPrevia = document.getElementById("btnAlternarVistaPrevia");
const vistaPreviaResumen = document.getElementById("vistaPreviaResumen");

// Listas dinámicas de la ficha
const listaObjetivos = document.getElementById("listaObjetivos");
const inputNuevoObjetivo = document.getElementById("inputNuevoObjetivo");
const btnAgregarObjetivo = document.getElementById("btnAgregarObjetivo");

const listaEjemplos = document.getElementById("listaEjemplos");
const inputNuevoEjemplo = document.getElementById("inputNuevoEjemplo");
const btnAgregarEjemplo = document.getElementById("btnAgregarEjemplo");

const listaErrores = document.getElementById("listaErrores");
const inputNuevoError = document.getElementById("inputNuevoError");
const btnAgregarError = document.getElementById("btnAgregarError");

const listaPreguntas = document.getElementById("listaPreguntas");
const inputNuevaPregunta = document.getElementById("inputNuevaPregunta");
const btnAgregarPregunta = document.getElementById("btnAgregarPregunta");

const listaRecursos = document.getElementById("listaRecursos");
const btnNuevoRecurso = document.getElementById("btnNuevoRecurso");
const inputSubirRecurso = document.getElementById("inputSubirRecurso");

// Elementos de Glosario
const metricaTotalTerminos = document.getElementById("metricaTotalTerminos");
const metricaTerminosSeisLetras = document.getElementById("metricaTerminosSeisLetras");
const indicadorJuegos = document.getElementById("indicadorJuegos");
const iconoIndicadorJuegos = document.getElementById("iconoIndicadorJuegos");
const tituloIndicadorJuegos = document.getElementById("tituloIndicadorJuegos");
const detalleIndicadorJuegos = document.getElementById("detalleIndicadorJuegos");
const btnNuevoTermino = document.getElementById("btnNuevoTermino");
const cuerpoTablaGlosario = document.getElementById("cuerpoTablaGlosario");

// Modal Término
const modalTermino = document.getElementById("modalTermino");
const tituloModalTermino = document.getElementById("tituloModalTermino");
const formTermino = document.getElementById("formTermino");
const inputTermino = document.getElementById("inputTermino");
const infoLongitudTermino = document.getElementById("infoLongitudTermino");
const errorTermino = document.getElementById("errorTermino");
const inputDefinicion = document.getElementById("inputDefinicion");
const contadorPalabrasDefinicion = document.getElementById("contadorPalabrasDefinicion");
const errorDefinicion = document.getElementById("errorDefinicion");
const inputPista = document.getElementById("inputPista");
const contadorPalabrasPista = document.getElementById("contadorPalabrasPista");
const errorPista = document.getElementById("errorPista");
const inputRetroalimentacion = document.getElementById("inputRetroalimentacion");
const btnCerrarModalTermino = document.getElementById("btnCerrarModalTermino");
const btnCancelarTermino = document.getElementById("btnCancelarTermino");

// Estado local
let temaActual = null;
let unidadActual = null;
let asignaturaActual = null;
let terminosGlosario = [];
let hayCambiosSinGuardar = false;

// Estado de listas en memoria
let objetivos = [];
let ejemplos = [];
let erroresFrecuentes = [];
let preguntasGuia = [];
let recursos = [];
let terminoEnEdicion = null;
let recursoEnSubidaIndice = null;

// Inicialización
await inicializar();

async function inicializar() {
  ui.cargando(true);
  try {
    const [temaData, glosarioData] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("glosario", { temaId })
    ]);

    temaActual = temaData;
    terminosGlosario = glosarioData;

    // Obtener información jerárquica (unidad y asignatura) para el contexto
    try {
      if (temaActual.unidadId) {
        unidadActual = await api.obtener("unidades", temaActual.unidadId);
        if (unidadActual?.asignaturaId) {
          asignaturaActual = await api.obtener("asignaturas", unidadActual.asignaturaId);
        }
      }
    } catch {
      // Información jerárquica auxiliar no bloqueante
    }

    poblarCabecera();
    poblarFicha();
    renderizarGlosario();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la información del tema", "error");
    encabezadoTituloTema.textContent = "Error al cargar el tema";
  } finally {
    ui.cargando(false);
  }

  configurarEventos();
}

function poblarCabecera() {
  encabezadoTituloTema.textContent = temaActual.titulo || "Tema sin título";

  const miga = [];
  if (asignaturaActual?.nombre) miga.push(asignaturaActual.nombre);
  if (unidadActual?.titulo) miga.push(unidadActual.titulo);
  miga.push(temaActual.titulo);

  encabezadoSubtitulo.textContent = miga.join(" › ");
}

function poblarFicha() {
  campoTitulo.value = temaActual.titulo || "";
  campoEstado.value = temaActual.estado || "borrador";
  campoDificultad.value = String(temaActual.dificultad || 2);
  campoPalabrasClave.value = Array.isArray(temaActual.palabrasClave)
    ? temaActual.palabrasClave.join(", ")
    : temaActual.palabrasClave || "";
  campoFuentes.value = temaActual.fuentes || "";
  campoResumen.value = temaActual.resumen || "";

  objetivos = Array.isArray(temaActual.objetivos) ? [...temaActual.objetivos] : [];
  ejemplos = Array.isArray(temaActual.ejemplos) ? [...temaActual.ejemplos] : [];
  erroresFrecuentes = Array.isArray(temaActual.erroresFrecuentes) ? [...temaActual.erroresFrecuentes] : [];
  preguntasGuia = Array.isArray(temaActual.preguntasGuia) ? [...temaActual.preguntasGuia] : [];
  recursos = Array.isArray(temaActual.recursos) ? JSON.parse(JSON.stringify(temaActual.recursos)) : [];

  actualizarContadorResumen();
  renderizarListaSimple(listaObjetivos, objetivos, "objetivo");
  renderizarListaSimple(listaEjemplos, ejemplos, "ejemplo");
  renderizarListaSimple(listaErrores, erroresFrecuentes, "error");
  renderizarListaSimple(listaPreguntas, preguntasGuia, "pregunta");
  renderizarRecursos();

  hayCambiosSinGuardar = false;
}

// -------------------------------------------------------------------
// EVENTOS Y NAVEGACIÓN
// -------------------------------------------------------------------

function configurarEventos() {
  // Cambio de pestañas
  tabBtnFicha.addEventListener("click", () => cambiarPestana("ficha"));
  tabBtnGlosario.addEventListener("click", () => cambiarPestana("glosario"));

  // Evitar recarga de página por submit nativo con tecla Enter dentro del formulario
  formFichaTema.addEventListener("submit", (e) => {
    e.preventDefault();
    guardarFichaTema();
  });

  // Guardar Ficha
  btnGuardarTema.addEventListener("click", guardarFichaTema);

  // Advertencia de cambios sin guardar al salir
  window.addEventListener("beforeunload", (e) => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  enlaceVolver.addEventListener("click", async (e) => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      const seguro = await ui.confirmar("Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?");
      if (seguro) {
        hayCambiosSinGuardar = false;
        window.location.href = enlaceVolver.getAttribute("href");
      }
    }
  });

  // Detección de cambios en campos de formulario
  [campoTitulo, campoEstado, campoDificultad, campoPalabrasClave, campoFuentes].forEach((el) => {
    el.addEventListener("input", () => marcarCambio());
  });

  campoResumen.addEventListener("input", () => {
    marcarCambio();
    actualizarContadorResumen();
  });

  btnAlternarVistaPrevia.addEventListener("click", alternarVistaPreviaResumen);

  // Listas dinámicas: Objetivos
  btnAgregarObjetivo.addEventListener("click", () => agregarElementoLista(inputNuevoObjetivo, objetivos, listaObjetivos, "objetivo"));
  inputNuevoObjetivo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      agregarElementoLista(inputNuevoObjetivo, objetivos, listaObjetivos, "objetivo");
    }
  });

  // Listas dinámicas: Ejemplos
  btnAgregarEjemplo.addEventListener("click", () => agregarElementoLista(inputNuevoEjemplo, ejemplos, listaEjemplos, "ejemplo"));
  inputNuevoEjemplo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      agregarElementoLista(inputNuevoEjemplo, ejemplos, listaEjemplos, "ejemplo");
    }
  });

  // Listas dinámicas: Errores Frecuentes
  btnAgregarError.addEventListener("click", () => agregarElementoLista(inputNuevoError, erroresFrecuentes, listaErrores, "error"));
  inputNuevoError.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      agregarElementoLista(inputNuevoError, erroresFrecuentes, listaErrores, "error");
    }
  });

  // Listas dinámicas: Preguntas Guía
  btnAgregarPregunta.addEventListener("click", () => agregarElementoLista(inputNuevaPregunta, preguntasGuia, listaPreguntas, "pregunta"));
  inputNuevaPregunta.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      agregarElementoLista(inputNuevaPregunta, preguntasGuia, listaPreguntas, "pregunta");
    }
  });

  // Recursos
  btnNuevoRecurso.addEventListener("click", agregarNuevoRecurso);
  inputSubirRecurso.addEventListener("change", manejarSubidaArchivo);

  // Glosario
  btnNuevoTermino.addEventListener("click", () => abrirModalTermino());
  btnCerrarModalTermino.addEventListener("click", cerrarModalTermino);
  btnCancelarTermino.addEventListener("click", cerrarModalTermino);
  formTermino.addEventListener("submit", guardarTermino);

  inputTermino.addEventListener("input", actualizarMetricasModalTermino);
  inputDefinicion.addEventListener("input", actualizarMetricasModalDefinicion);
  inputPista.addEventListener("input", actualizarMetricasModalPista);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalTermino.style.display !== "none") {
      cerrarModalTermino();
    }
  });
}

function marcarCambio() {
  hayCambiosSinGuardar = true;
  btnGuardarTema.classList.add("btn--acento");
}

function cambiarPestana(pestana) {
  if (pestana === "ficha") {
    tabBtnFicha.classList.add("pestana-btn--activa");
    tabBtnFicha.setAttribute("aria-selected", "true");
    tabBtnGlosario.classList.remove("pestana-btn--activa");
    tabBtnGlosario.setAttribute("aria-selected", "false");

    panelFicha.style.display = "block";
    panelGlosario.style.display = "none";
  } else {
    tabBtnGlosario.classList.add("pestana-btn--activa");
    tabBtnGlosario.setAttribute("aria-selected", "true");
    tabBtnFicha.classList.remove("pestana-btn--activa");
    tabBtnFicha.setAttribute("aria-selected", "false");

    panelFicha.style.display = "none";
    panelGlosario.style.display = "block";
  }
}

// -------------------------------------------------------------------
// GESTIÓN DE RESUMEN Y FORMATO
// -------------------------------------------------------------------

function contarPalabras(texto) {
  if (!texto || typeof texto !== "string") return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function actualizarContadorResumen() {
  const palabras = contarPalabras(campoResumen.value);
  contadorPalabrasResumen.textContent = `${palabras} ${palabras === 1 ? "palabra" : "palabras"}`;

  contenedorContadorPalabras.classList.remove(
    "resumen-contador-badge--exito",
    "resumen-contador-badge--advertencia"
  );

  if (palabras >= 300 && palabras <= 800) {
    contenedorContadorPalabras.classList.add("resumen-contador-badge--exito");
  } else if (palabras > 0) {
    contenedorContadorPalabras.classList.add("resumen-contador-badge--advertencia");
  }
}

function alternarVistaPreviaResumen() {
  const estaOculta = vistaPreviaResumen.style.display === "none";
  if (estaOculta) {
    vistaPreviaResumen.innerHTML = util.formatoBasico(campoResumen.value) || "<p class='texto-suave'>Sin contenido para previsualizar.</p>";
    vistaPreviaResumen.style.display = "block";
    campoResumen.style.display = "none";
    btnAlternarVistaPrevia.textContent = "Editar texto del resumen";
  } else {
    vistaPreviaResumen.style.display = "none";
    campoResumen.style.display = "block";
    btnAlternarVistaPrevia.textContent = "Ver vista previa con formato";
    campoResumen.focus();
  }
}

// -------------------------------------------------------------------
// LISTAS DINÁMICAS (Objetivos, Ejemplos, Errores, Preguntas)
// -------------------------------------------------------------------

function agregarElementoLista(input, coleccion, contenedor, tipo) {
  const texto = input.value.trim();
  if (!texto) return;

  coleccion.push(texto);
  input.value = "";
  marcarCambio();
  renderizarListaSimple(contenedor, coleccion, tipo);
}

function eliminarElementoLista(coleccion, indice, contenedor, tipo) {
  coleccion.splice(indice, 1);
  marcarCambio();
  renderizarListaSimple(contenedor, coleccion, tipo);
}

function renderizarListaSimple(contenedor, coleccion, tipo) {
  if (coleccion.length === 0) {
    contenedor.innerHTML = `<li class="texto-suave texto-xs" style="padding: var(--espacio-xs) 0;">No hay elementos agregados todavía.</li>`;
    return;
  }

  contenedor.innerHTML = coleccion
    .map(
      (item, idx) => `
      <li class="item-lista">
        <span class="item-lista__texto">${ui.escapar(item)}</span>
        <button type="button" class="btn-eliminar-item" data-idx="${idx}" title="Eliminar elemento" aria-label="Eliminar ${tipo}">
          ✕
        </button>
      </li>
    `
    )
    .join("");

  contenedor.querySelectorAll(".btn-eliminar-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      eliminarElementoLista(coleccion, idx, contenedor, tipo);
    });
  });
}

// -------------------------------------------------------------------
// RECURSOS MULTIMEDIA Y DOCUMENTOS
// -------------------------------------------------------------------

function sincronizarRecursosDesdeDOM() {
  const tarjetas = listaRecursos.querySelectorAll(".tarjeta-recurso");
  if (!tarjetas || tarjetas.length === 0) {
    return;
  }

  const sincronizados = [];
  tarjetas.forEach((tarjeta) => {
    const selTipo = tarjeta.querySelector(".rec-tipo");
    const inputTitulo = tarjeta.querySelector(".rec-titulo");
    const inputUrl = tarjeta.querySelector(".rec-url");

    const tipo = selTipo ? selTipo.value : "enlace";
    let titulo = inputTitulo ? inputTitulo.value.trim() : "";
    let url = inputUrl ? inputUrl.value.trim() : "";

    if (url) {
      if (tipo === "enlace" && !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
        url = `https://${url}`;
      }
      if (!titulo) {
        titulo = tipo === "enlace" ? "Enlace web complementario" : "Recurso complementario";
      }
      sincronizados.push({ tipo, titulo, url });
    }
  });

  recursos = sincronizados;
}

function agregarNuevoRecurso() {
  sincronizarRecursosDesdeDOM();
  recursos.push({
    tipo: "enlace",
    titulo: "",
    url: ""
  });
  marcarCambio();
  renderizarRecursos();
  setTimeout(() => {
    const ultimoInput = listaRecursos.querySelector(".tarjeta-recurso:last-child .rec-url");
    if (ultimoInput) ultimoInput.focus();
  }, 50);
}

function eliminarRecurso(indice) {
  sincronizarRecursosDesdeDOM();
  recursos.splice(indice, 1);
  marcarCambio();
  renderizarRecursos();
}

function renderizarRecursos() {
  if (recursos.length === 0) {
    listaRecursos.innerHTML = `
      <div class="tarjeta-vacia">
        <p>No se han configurado recursos para este tema.</p>
      </div>
    `;
    return;
  }

  listaRecursos.innerHTML = recursos
    .map((rec, idx) => {
      const admiteSubida = rec.tipo === "pdf" || rec.tipo === "imagen";

      return `
        <div class="tarjeta-recurso" data-idx="${idx}">
          <div class="tarjeta-recurso__fila">
            <div class="campo" style="margin-bottom: 0;">
              <label for="rec-tipo-${idx}" class="texto-xs">Tipo</label>
              <select id="rec-tipo-${idx}" class="rec-tipo" data-idx="${idx}">
                <option value="enlace" ${rec.tipo === "enlace" ? "selected" : ""}>Enlace web</option>
                <option value="video" ${rec.tipo === "video" ? "selected" : ""}>Video</option>
                <option value="pdf" ${rec.tipo === "pdf" ? "selected" : ""}>Documento PDF</option>
                <option value="imagen" ${rec.tipo === "imagen" ? "selected" : ""}>Imagen</option>
                <option value="lectura" ${rec.tipo === "lectura" ? "selected" : ""}>Lectura</option>
              </select>
            </div>

            <div class="campo" style="margin-bottom: 0;">
              <label for="rec-titulo-${idx}" class="texto-xs">Título del recurso</label>
              <input type="text" id="rec-titulo-${idx}" class="rec-titulo" data-idx="${idx}" value="${ui.escapar(rec.titulo || "")}" placeholder="Ej: UNESCO - Tradiciones orales">
            </div>

            <div class="campo" style="margin-bottom: 0;">
              <label for="rec-url-${idx}" class="texto-xs">URL o ruta</label>
              <div class="tarjeta-recurso__url-bloque">
                <input type="text" id="rec-url-${idx}" class="rec-url" data-idx="${idx}" value="${ui.escapar(rec.url || "")}" placeholder="https://... o /recursos/subidas/...">
                ${
                  admiteSubida
                    ? `<button type="button" class="btn btn--secundario btn--pequeno btnSubirArchivoRecurso" data-idx="${idx}" title="Subir archivo al servidor">
                         Subir
                       </button>`
                    : ""
                }
              </div>
            </div>

            <button type="button" class="btn-eliminar-item btnEliminarRecurso" data-idx="${idx}" title="Eliminar recurso" style="align-self: center; margin-top: 18px;">
              ✕
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Eventos de inputs de recursos
  listaRecursos.querySelectorAll(".rec-tipo").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      sincronizarRecursosDesdeDOM();
      if (recursos[idx]) {
        recursos[idx].tipo = e.target.value;
      }
      marcarCambio();
      renderizarRecursos();
    });
  });

  listaRecursos.querySelectorAll(".rec-titulo").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (recursos[idx]) recursos[idx].titulo = e.target.value;
      marcarCambio();
    });
    input.addEventListener("change", () => {
      sincronizarRecursosDesdeDOM();
      marcarCambio();
    });
  });

  listaRecursos.querySelectorAll(".rec-url").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-idx"), 10);
      if (recursos[idx]) recursos[idx].url = e.target.value;
      marcarCambio();
    });
    input.addEventListener("change", () => {
      sincronizarRecursosDesdeDOM();
      marcarCambio();
    });
  });

  listaRecursos.querySelectorAll(".btnSubirArchivoRecurso").forEach((btn) => {
    btn.addEventListener("click", () => {
      recursoEnSubidaIndice = parseInt(btn.getAttribute("data-idx"), 10);
      const tipo = recursos[recursoEnSubidaIndice].tipo;
      if (tipo === "pdf") {
        inputSubirRecurso.accept = ".pdf,application/pdf";
      } else {
        inputSubirRecurso.accept = "image/png,image/jpeg,image/webp";
      }
      inputSubirRecurso.click();
    });
  });

  listaRecursos.querySelectorAll(".btnEliminarRecurso").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      eliminarRecurso(idx);
    });
  });
}

async function manejarSubidaArchivo(e) {
  const archivo = e.target.files?.[0];
  if (!archivo || recursoEnSubidaIndice === null) return;

  ui.cargando(true);
  try {
    const respuesta = await api.subir(archivo);
    if (respuesta?.url) {
      recursos[recursoEnSubidaIndice].url = respuesta.url;
      if (!recursos[recursoEnSubidaIndice].titulo) {
        recursos[recursoEnSubidaIndice].titulo = archivo.name.replace(/\.[^/.]+$/, "");
      }
      marcarCambio();
      renderizarRecursos();
      ui.aviso("Archivo subido con éxito", "exito");
    }
  } catch (err) {
    ui.aviso(err.message || "Error al subir archivo", "error");
  } finally {
    ui.cargando(false);
    inputSubirRecurso.value = "";
    recursoEnSubidaIndice = null;
  }
}

// -------------------------------------------------------------------
// GUARDAR FICHA DEL TEMA
// -------------------------------------------------------------------

async function guardarFichaTema() {
  // Sincronizar estado actual de recursos desde el DOM antes de guardar
  sincronizarRecursosDesdeDOM();

  const titulo = campoTitulo.value.trim();
  if (!titulo) {
    ui.aviso("El título del tema es obligatorio", "error");
    campoTitulo.focus();
    return;
  }

  const palabrasClave = campoPalabrasClave.value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const datosActualizados = {
    titulo,
    estado: campoEstado.value,
    dificultad: Number(campoDificultad.value) || 2,
    palabrasClave,
    fuentes: campoFuentes.value.trim(),
    resumen: campoResumen.value.trim(),
    objetivos,
    ejemplos,
    erroresFrecuentes,
    preguntasGuia,
    recursos
  };

  ui.cargando(true);
  btnGuardarTema.disabled = true;

  try {
    const actualizado = await api.actualizar("temas", temaId, datosActualizados);
    temaActual = actualizado;
    hayCambiosSinGuardar = false;
    btnGuardarTema.classList.remove("btn--acento");
    encabezadoTituloTema.textContent = temaActual.titulo;

    ui.aviso("Ficha pedagógica guardada con éxito", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la ficha del tema", "error");
  } finally {
    ui.cargando(false);
    btnGuardarTema.disabled = false;
  }
}

// -------------------------------------------------------------------
// GESTIÓN DEL GLOSARIO Y MÉTRICAS DE JUEGOS
// -------------------------------------------------------------------

function calcularLongitudNormalizada(palabra) {
  if (!palabra || typeof palabra !== "string") return 0;
  const normalizada = util.normalizar(palabra);
  return normalizada.replace(/[^A-ZÑ]/g, "").length;
}

function renderizarGlosario() {
  badgeContadorGlosario.textContent = String(terminosGlosario.length);
  metricaTotalTerminos.textContent = String(terminosGlosario.length);

  // Contar términos de exactamente 6 letras normalizadas
  const cantidadSeisLetras = terminosGlosario.filter((t) => {
    return calcularLongitudNormalizada(t.termino) === 6;
  }).length;

  metricaTerminosSeisLetras.textContent = String(cantidadSeisLetras);

  // Evaluación de aptitud para juegos (al menos 12 términos y al menos 3 de 6 letras)
  const totalValido = terminosGlosario.length >= 12;
  const seisLetrasValido = cantidadSeisLetras >= 3;
  const esApto = totalValido && seisLetrasValido;

  indicadorJuegos.className = `indicador-juegos ${esApto ? "indicador-juegos--apto" : "indicador-juegos--incompleto"}`;
  iconoIndicadorJuegos.textContent = esApto ? "🎮" : "⚠️";
  tituloIndicadorJuegos.textContent = esApto ? "¡Apto para juegos!" : "No apto para juegos aún";

  if (esApto) {
    detalleIndicadorJuegos.textContent = "Cumple con todos los requisitos para crucigramas, ahorcado y dinámicas.";
  } else {
    const detallesFaltantes = [];
    if (!totalValido) detallesFaltantes.push(`faltan ${12 - terminosGlosario.length} términos (mín. 12)`);
    if (!seisLetrasValido) detallesFaltantes.push(`faltan ${3 - cantidadSeisLetras} de 6 letras (mín. 3)`);
    detalleIndicadorJuegos.textContent = `Requisitos pendientes: ${detallesFaltantes.join(" y ")}.`;
  }

  // Renderizar tabla
  if (terminosGlosario.length === 0) {
    cuerpoTablaGlosario.innerHTML = `
      <tr>
        <td colspan="6" class="texto-centro" style="padding: var(--espacio-l);">
          <p>No hay términos registrados en el glosario de este tema.</p>
          <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimerTermino" style="margin-top: var(--espacio-s);">
            Crear primer término
          </button>
        </td>
      </tr>
    `;
    const btnPrimer = document.getElementById("btnCrearPrimerTermino");
    if (btnPrimer) btnPrimer.addEventListener("click", () => abrirModalTermino());
    return;
  }

  cuerpoTablaGlosario.innerHTML = terminosGlosario
    .map((t) => {
      const long = calcularLongitudNormalizada(t.termino);
      const esSeis = long === 6;

      return `
        <tr data-id="${ui.escapar(t.id)}">
          <td><strong>${ui.escapar(t.termino || "")}</strong></td>
          <td>
            <span class="insignia-longitud ${esSeis ? "insignia-longitud--seis" : ""}">
              ${long} ${long === 1 ? "letra" : "letras"}
            </span>
          </td>
          <td>${ui.escapar(t.definicion || "")}</td>
          <td>${ui.escapar(t.pista || "")}</td>
          <td>${ui.escapar(t.retroalimentacion || "-")}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn--secundario btn--pequeno btnEditarTermino" data-id="${ui.escapar(t.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btnEliminarTermino" data-id="${ui.escapar(t.id)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  cuerpoTablaGlosario.querySelectorAll(".btnEditarTermino").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const termino = terminosGlosario.find((item) => item.id === id);
      if (termino) abrirModalTermino(termino);
    });
  });

  cuerpoTablaGlosario.querySelectorAll(".btnEliminarTermino").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      eliminarTermino(id);
    });
  });
}

// -------------------------------------------------------------------
// MODAL DE AGREGAR / EDITAR TÉRMINO DE GLOSARIO
// -------------------------------------------------------------------

function actualizarMetricasModalTermino() {
  const termino = inputTermino.value.trim();
  const long = calcularLongitudNormalizada(termino);
  infoLongitudTermino.textContent = `Longitud: ${long} ${long === 1 ? "letra" : "letras"}${long === 6 ? " (¡Exactamente 6 letras!)" : ""}`;
  if (long === 6) {
    infoLongitudTermino.style.color = "var(--color-exito)";
  } else {
    infoLongitudTermino.style.color = "var(--color-texto-suave)";
  }
}

function actualizarMetricasModalDefinicion() {
  const palabras = contarPalabras(inputDefinicion.value);
  contadorPalabrasDefinicion.textContent = `${palabras} / 25 palabras`;
  if (palabras > 25) {
    contadorPalabrasDefinicion.style.color = "var(--color-error)";
    errorDefinicion.textContent = "La definición no debe superar las 25 palabras.";
    errorDefinicion.style.display = "block";
  } else {
    contadorPalabrasDefinicion.style.color = "var(--color-texto-suave)";
    errorDefinicion.style.display = "none";
  }
}

function actualizarMetricasModalPista() {
  const palabras = contarPalabras(inputPista.value);
  contadorPalabrasPista.textContent = `${palabras} / 10 palabras`;
  if (palabras > 10) {
    contadorPalabrasPista.style.color = "var(--color-error)";
    errorPista.textContent = "La pista no debe superar las 10 palabras.";
    errorPista.style.display = "block";
  } else {
    contadorPalabrasPista.style.color = "var(--color-texto-suave)";
    errorPista.style.display = "none";
  }
}

function abrirModalTermino(termino = null) {
  terminoEnEdicion = termino;
  errorTermino.style.display = "none";
  errorDefinicion.style.display = "none";
  errorPista.style.display = "none";

  if (termino) {
    tituloModalTermino.textContent = "Editar Término";
    inputTermino.value = termino.termino || "";
    inputDefinicion.value = termino.definicion || "";
    inputPista.value = termino.pista || "";
    inputRetroalimentacion.value = termino.retroalimentacion || "";
  } else {
    tituloModalTermino.textContent = "Nuevo Término";
    formTermino.reset();
  }

  actualizarMetricasModalTermino();
  actualizarMetricasModalDefinicion();
  actualizarMetricasModalPista();

  modalTermino.style.display = "flex";
  setTimeout(() => inputTermino.focus(), 50);
}

function cerrarModalTermino() {
  modalTermino.style.display = "none";
  terminoEnEdicion = null;
  formTermino.reset();
}

async function guardarTermino(e) {
  e.preventDefault();

  const terminoTexto = inputTermino.value.trim().toUpperCase();
  const definicionTexto = inputDefinicion.value.trim();
  const pistaTexto = inputPista.value.trim();
  const retroalimentacionTexto = inputRetroalimentacion.value.trim();

  let hayErrores = false;

  if (!terminoTexto) {
    errorTermino.textContent = "El término es obligatorio.";
    errorTermino.style.display = "block";
    hayErrores = true;
  } else {
    errorTermino.style.display = "none";
  }

  const palabrasDef = contarPalabras(definicionTexto);
  if (!definicionTexto) {
    errorDefinicion.textContent = "La definición es obligatoria.";
    errorDefinicion.style.display = "block";
    hayErrores = true;
  } else if (palabrasDef > 25) {
    errorDefinicion.textContent = `La definición tiene ${palabrasDef} palabras (máximo 25 permitidas).`;
    errorDefinicion.style.display = "block";
    hayErrores = true;
  } else {
    errorDefinicion.style.display = "none";
  }

  const palabrasPista = contarPalabras(pistaTexto);
  if (!pistaTexto) {
    errorPista.textContent = "La pista es obligatoria.";
    errorPista.style.display = "block";
    hayErrores = true;
  } else if (palabrasPista > 10) {
    errorPista.textContent = `La pista tiene ${palabrasPista} palabras (máximo 10 permitidas).`;
    errorPista.style.display = "block";
    hayErrores = true;
  } else {
    errorPista.style.display = "none";
  }

  if (hayErrores) return;

  ui.cargando(true);
  try {
    if (terminoEnEdicion) {
      const actualizado = await api.actualizar("glosario", terminoEnEdicion.id, {
        termino: terminoTexto,
        definicion: definicionTexto,
        pista: pistaTexto,
        retroalimentacion: retroalimentacionTexto
      });

      const indice = terminosGlosario.findIndex((item) => item.id === terminoEnEdicion.id);
      if (indice !== -1) terminosGlosario[indice] = actualizado;
      ui.aviso("Término actualizado correctamente", "exito");
    } else {
      const nuevo = await api.crear("glosario", {
        temaId,
        termino: terminoTexto,
        definicion: definicionTexto,
        pista: pistaTexto,
        retroalimentacion: retroalimentacionTexto,
        origen: "docente",
        estado: "aprobado"
      });

      terminosGlosario.push(nuevo);
      ui.aviso("Término agregado al glosario", "exito");
    }

    cerrarModalTermino();
    renderizarGlosario();
  } catch (err) {
    ui.aviso(err.message || "Error al guardar el término", "error");
  } finally {
    ui.cargando(false);
  }
}

async function eliminarTermino(id) {
  const termino = terminosGlosario.find((item) => item.id === id);
  if (!termino) return;

  const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar el término "${termino.termino}"?`);
  if (!confirmado) return;

  ui.cargando(true);
  try {
    await api.eliminar("glosario", id);
    terminosGlosario = terminosGlosario.filter((item) => item.id !== id);
    renderizarGlosario();
    ui.aviso("Término eliminado del glosario", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al eliminar el término", "error");
  } finally {
    ui.cargando(false);
  }
}
