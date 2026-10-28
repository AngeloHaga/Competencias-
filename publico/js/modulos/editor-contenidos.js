// publico/js/modulos/editor-contenidos.js · Editor de unidades y temas curriculares
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Editor de contenidos", roles: ["docente", "admin"] });

// Elementos DOM principales
const selectorAsignatura = document.getElementById("selectorAsignatura");
const badgeNivelAsignatura = document.getElementById("badgeNivelAsignatura");
const panelTrabajo = document.getElementById("panelTrabajo");
const mensajeSinAsignaturas = document.getElementById("mensajeSinAsignaturas");

// Elementos de Unidades
const btnNuevaUnidad = document.getElementById("btnNuevaUnidad");
const contadorUnidades = document.getElementById("contadorUnidades");
const listaUnidades = document.getElementById("listaUnidades");

// Elementos de Temas
const btnNuevoTema = document.getElementById("btnNuevoTema");
const contadorTemas = document.getElementById("contadorTemas");
const listaTemas = document.getElementById("listaTemas");

// Modal Unidad
const modalUnidad = document.getElementById("modalUnidad");
const tituloModalUnidad = document.getElementById("tituloModalUnidad");
const formUnidad = document.getElementById("formUnidad");
const inputTituloUnidad = document.getElementById("inputTituloUnidad");
const errorTituloUnidad = document.getElementById("errorTituloUnidad");
const btnCerrarModalUnidad = document.getElementById("btnCerrarModalUnidad");
const btnCancelarUnidad = document.getElementById("btnCancelarUnidad");

// Modal Tema
const modalTema = document.getElementById("modalTema");
const tituloModalTema = document.getElementById("tituloModalTema");
const formTema = document.getElementById("formTema");
const inputTituloTema = document.getElementById("inputTituloTema");
const errorTituloTema = document.getElementById("errorTituloTema");
const btnCerrarModalTema = document.getElementById("btnCerrarModalTema");
const btnCancelarTema = document.getElementById("btnCancelarTema");

// Estado local
let asignaturas = [];
let asignaturaSeleccionadaId = null;
let unidades = [];
let unidadSeleccionadaId = null;
let temas = [];
let unidadEnEdicion = null; // null si es nueva, objeto si es renombrar

// Inicialización
await inicializar();

async function inicializar() {
  ui.cargando(true);
  try {
    asignaturas = await api.listar("asignaturas");

    if (asignaturas.length === 0) {
      selectorAsignatura.innerHTML = '<option value="" disabled selected>No tienes asignaturas disponibles</option>';
      panelTrabajo.style.display = "none";
      mensajeSinAsignaturas.style.display = "block";
      return;
    }

    mensajeSinAsignaturas.style.display = "none";
    poblarSelectorAsignaturas();

    // Seleccionar la primera asignatura por defecto
    asignaturaSeleccionadaId = asignaturas[0].id;
    selectorAsignatura.value = asignaturaSeleccionadaId;
    actualizarBadgeNivel();

    panelTrabajo.style.display = "grid";
    await cargarUnidades();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las asignaturas", "error");
  } finally {
    ui.cargando(false);
  }

  // Event Listeners principales
  selectorAsignatura.addEventListener("change", manejarCambioAsignatura);
  btnNuevaUnidad.addEventListener("click", () => abrirModalUnidad());
  btnNuevoTema.addEventListener("click", () => abrirModalTema());

  // Listeners modales
  configurarModales();
}

function poblarSelectorAsignaturas() {
  selectorAsignatura.innerHTML = asignaturas
    .map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre || "Sin nombre")} (${ui.escapar(a.nivel || "Nivel no definido")})</option>`)
    .join("");
}

function actualizarBadgeNivel() {
  const asig = asignaturas.find((a) => a.id === asignaturaSeleccionadaId);
  if (asig && asig.nivel) {
    badgeNivelAsignatura.textContent = asig.nivel;
    badgeNivelAsignatura.style.display = "inline-flex";
  } else {
    badgeNivelAsignatura.style.display = "none";
  }
}

async function manejarCambioAsignatura(e) {
  asignaturaSeleccionadaId = e.target.value;
  actualizarBadgeNivel();
  unidadSeleccionadaId = null;
  temas = [];
  actualizarVistaTemasVacia();
  await cargarUnidades();
}

// -------------------------------------------------------------------
// GESTIÓN DE UNIDADES
// -------------------------------------------------------------------

async function cargarUnidades() {
  if (!asignaturaSeleccionadaId) return;

  ui.cargando(true);
  try {
    const lista = await api.listar("unidades", { asignaturaId: asignaturaSeleccionadaId });
    unidades = lista.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    renderizarUnidades();

    // Si había una unidad seleccionada, intentar mantenerla o seleccionar la primera
    if (unidades.length > 0) {
      const existe = unidades.find((u) => u.id === unidadSeleccionadaId);
      if (existe) {
        await seleccionarUnidad(unidadSeleccionadaId);
      } else {
        await seleccionarUnidad(unidades[0].id);
      }
    } else {
      unidadSeleccionadaId = null;
      temas = [];
      actualizarVistaTemasVacia();
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las unidades", "error");
    listaUnidades.innerHTML = `<div class="tarjeta-vacia">Error al cargar unidades.</div>`;
  } finally {
    ui.cargando(false);
  }
}

function renderizarUnidades() {
  contadorUnidades.textContent = `${unidades.length} ${unidades.length === 1 ? "unidad" : "unidades"}`;

  if (unidades.length === 0) {
    listaUnidades.innerHTML = `
      <div class="tarjeta-vacia">
        <p>No hay unidades en esta asignatura.</p>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimeraUnidad" style="margin-top: var(--espacio-s);">
          Crear primera unidad
        </button>
      </div>
    `;
    const btn = document.getElementById("btnCrearPrimeraUnidad");
    if (btn) btn.addEventListener("click", () => abrirModalUnidad());
    return;
  }

  listaUnidades.innerHTML = unidades
    .map((unidad, index) => {
      const esActiva = unidad.id === unidadSeleccionadaId;
      const esPrimera = index === 0;
      const esUltima = index === unidades.length - 1;
      const visible = unidad.visible !== false;

      return `
        <article class="item-unidad ${esActiva ? "item-unidad--activo" : ""}" data-id="${ui.escapar(unidad.id)}" role="button" tabindex="0">
          <div class="item-unidad__fila-principal">
            <div class="item-unidad__info">
              <span class="item-unidad__orden">Orden ${index + 1}</span>
              <h3 class="item-unidad__titulo">${ui.escapar(unidad.titulo || "Unidad sin título")}</h3>
            </div>
            <span class="insignia ${visible ? "insignia-visible" : "insignia-oculto"}">
              ${visible ? "Visible" : "Oculto"}
            </span>
          </div>

          <div class="item-unidad__acciones" onclick="event.stopPropagation();">
            <button type="button" class="btn-orden btnSubirUnidad" data-id="${ui.escapar(unidad.id)}" title="Subir orden" aria-label="Subir unidad" ${esPrimera ? "disabled" : ""}>
              ▲
            </button>
            <button type="button" class="btn-orden btnBajarUnidad" data-id="${ui.escapar(unidad.id)}" title="Bajar orden" aria-label="Bajar unidad" ${esUltima ? "disabled" : ""}>
              ▼
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btnRenombrarUnidad" data-id="${ui.escapar(unidad.id)}">
              Renombrar
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btnToggleVisibilidadUnidad" data-id="${ui.escapar(unidad.id)}">
              ${visible ? "Ocultar" : "Mostrar"}
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btnEliminarUnidad" data-id="${ui.escapar(unidad.id)}" title="Eliminar unidad">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  // Listeners para selección de unidades
  listaUnidades.querySelectorAll(".item-unidad").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      seleccionarUnidad(id);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = el.getAttribute("data-id");
        seleccionarUnidad(id);
      }
    });
  });

  // Listeners de acciones de unidades
  listaUnidades.querySelectorAll(".btnSubirUnidad").forEach((btn) => {
    btn.addEventListener("click", () => moverUnidad(btn.getAttribute("data-id"), -1));
  });
  listaUnidades.querySelectorAll(".btnBajarUnidad").forEach((btn) => {
    btn.addEventListener("click", () => moverUnidad(btn.getAttribute("data-id"), 1));
  });
  listaUnidades.querySelectorAll(".btnRenombrarUnidad").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const unidad = unidades.find((u) => u.id === id);
      if (unidad) abrirModalUnidad(unidad);
    });
  });
  listaUnidades.querySelectorAll(".btnToggleVisibilidadUnidad").forEach((btn) => {
    btn.addEventListener("click", () => toggleVisibilidadUnidad(btn.getAttribute("data-id")));
  });
  listaUnidades.querySelectorAll(".btnEliminarUnidad").forEach((btn) => {
    btn.addEventListener("click", () => eliminarUnidad(btn.getAttribute("data-id")));
  });
}

async function seleccionarUnidad(unidadId) {
  unidadSeleccionadaId = unidadId;

  // Actualizar clases activas en la lista
  listaUnidades.querySelectorAll(".item-unidad").forEach((el) => {
    const id = el.getAttribute("data-id");
    if (id === unidadId) {
      el.classList.add("item-unidad--activo");
    } else {
      el.classList.remove("item-unidad--activo");
    }
  });

  btnNuevoTema.disabled = false;
  const unidad = unidades.find((u) => u.id === unidadId);
  contadorTemas.textContent = unidad ? `Unidad: ${unidad.titulo}` : "";

  await cargarTemas();
}

async function moverUnidad(id, direccion) {
  const indice = unidades.findIndex((u) => u.id === id);
  if (indice === -1) return;
  const nuevoIndice = indice + direccion;
  if (nuevoIndice < 0 || nuevoIndice >= unidades.length) return;

  ui.cargando(true);
  try {
    const actual = unidades[indice];
    const adyacente = unidades[nuevoIndice];

    // Reasignar orden secuencial para garantizar consistencia
    const ordenActual = nuevoIndice + 1;
    const ordenAdyacente = indice + 1;

    await Promise.all([
      api.actualizar("unidades", actual.id, { orden: ordenActual }),
      api.actualizar("unidades", adyacente.id, { orden: ordenAdyacente })
    ]);

    await cargarUnidades();
    ui.aviso("Orden de unidades actualizado", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al mover la unidad", "error");
  } finally {
    ui.cargando(false);
  }
}

async function toggleVisibilidadUnidad(id) {
  const unidad = unidades.find((u) => u.id === id);
  if (!unidad) return;

  const nuevaVisibilidad = !(unidad.visible !== false);

  ui.cargando(true);
  try {
    await api.actualizar("unidades", id, { visible: nuevaVisibilidad });
    unidad.visible = nuevaVisibilidad;
    renderizarUnidades();
    ui.aviso(nuevaVisibilidad ? "Unidad ahora visible" : "Unidad ahora oculta", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar visibilidad", "error");
  } finally {
    ui.cargando(false);
  }
}

async function eliminarUnidad(id) {
  const unidad = unidades.find((u) => u.id === id);
  if (!unidad) return;

  // Verificar si tiene temas asociados
  const temasAsociados = await api.listar("temas", { unidadId: id });
  if (temasAsociados.length > 0) {
    ui.aviso("No puedes eliminar una unidad que contiene temas. Elimina o mueve los temas primero.", "advertencia");
    return;
  }

  const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar la unidad "${unidad.titulo}"?`);
  if (!confirmado) return;

  ui.cargando(true);
  try {
    await api.eliminar("unidades", id);
    ui.aviso("Unidad eliminada correctamente", "exito");
    if (unidadSeleccionadaId === id) {
      unidadSeleccionadaId = null;
    }
    await cargarUnidades();
  } catch (err) {
    ui.aviso(err.message || "Error al eliminar la unidad", "error");
  } finally {
    ui.cargando(false);
  }
}

// -------------------------------------------------------------------
// GESTIÓN DE TEMAS
// -------------------------------------------------------------------

function actualizarVistaTemasVacia() {
  btnNuevoTema.disabled = true;
  contadorTemas.textContent = "Selecciona una unidad";
  listaTemas.innerHTML = `<div class="tarjeta-vacia">Selecciona una unidad de la lista para ver y gestionar sus temas.</div>`;
}

async function cargarTemas() {
  if (!unidadSeleccionadaId) {
    actualizarVistaTemasVacia();
    return;
  }

  ui.cargando(true);
  try {
    const lista = await api.listar("temas", { unidadId: unidadSeleccionadaId });
    temas = lista.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    renderizarTemas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar los temas", "error");
    listaTemas.innerHTML = `<div class="tarjeta-vacia">Error al cargar los temas de esta unidad.</div>`;
  } finally {
    ui.cargando(false);
  }
}

function renderizarTemas() {
  const unidad = unidades.find((u) => u.id === unidadSeleccionadaId);
  const nombreUnidad = unidad ? unidad.titulo : "la unidad";
  contadorTemas.textContent = `${temas.length} ${temas.length === 1 ? "tema" : "temas"} en ${nombreUnidad}`;

  if (temas.length === 0) {
    listaTemas.innerHTML = `
      <div class="tarjeta-vacia">
        <p>No hay temas registrados en esta unidad.</p>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimerTema" style="margin-top: var(--espacio-s);">
          Crear primer tema
        </button>
      </div>
    `;
    const btn = document.getElementById("btnCrearPrimerTema");
    if (btn) btn.addEventListener("click", () => abrirModalTema());
    return;
  }

  listaTemas.innerHTML = temas
    .map((tema, index) => {
      const esPrimero = index === 0;
      const esUltimo = index === temas.length - 1;
      const esPublicado = tema.estado === "publicado";

      return `
        <article class="item-tema" data-id="${ui.escapar(tema.id)}">
          <div class="item-tema__fila-principal">
            <div class="item-tema__info">
              <span class="item-tema__orden">Tema ${index + 1}</span>
              <h3 class="item-tema__titulo">${ui.escapar(tema.titulo || "Tema sin título")}</h3>
            </div>
            <span class="insignia ${esPublicado ? "insignia-estado--publicado" : "insignia-estado--borrador"}">
              ${esPublicado ? "Publicado" : "Borrador"}
            </span>
          </div>

          <div class="item-tema__acciones">
            <div class="item-tema__grupo-orden">
              <button type="button" class="btn-orden btnSubirTema" data-id="${ui.escapar(tema.id)}" title="Subir orden" aria-label="Subir tema" ${esPrimero ? "disabled" : ""}>
                ▲
              </button>
              <button type="button" class="btn-orden btnBajarTema" data-id="${ui.escapar(tema.id)}" title="Bajar orden" aria-label="Bajar tema" ${esUltimo ? "disabled" : ""}>
                ▼
              </button>
            </div>

            <div class="item-tema__grupo-acciones">
              <button type="button" class="btn btn--secundario btn--pequeno btnToggleEstadoTema" data-id="${ui.escapar(tema.id)}">
                ${esPublicado ? "Pasar a borrador" : "Publicar"}
              </button>
              <a href="/paginas/editor-tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno">
                Editar ficha
              </a>
              <button type="button" class="btn btn--peligro btn--pequeno btnEliminarTema" data-id="${ui.escapar(tema.id)}" title="Eliminar tema">
                Eliminar
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // Listeners de temas
  listaTemas.querySelectorAll(".btnSubirTema").forEach((btn) => {
    btn.addEventListener("click", () => moverTema(btn.getAttribute("data-id"), -1));
  });
  listaTemas.querySelectorAll(".btnBajarTema").forEach((btn) => {
    btn.addEventListener("click", () => moverTema(btn.getAttribute("data-id"), 1));
  });
  listaTemas.querySelectorAll(".btnToggleEstadoTema").forEach((btn) => {
    btn.addEventListener("click", () => toggleEstadoTema(btn.getAttribute("data-id")));
  });
  listaTemas.querySelectorAll(".btnEliminarTema").forEach((btn) => {
    btn.addEventListener("click", () => eliminarTema(btn.getAttribute("data-id")));
  });
}

async function moverTema(id, direccion) {
  const indice = temas.findIndex((t) => t.id === id);
  if (indice === -1) return;
  const nuevoIndice = indice + direccion;
  if (nuevoIndice < 0 || nuevoIndice >= temas.length) return;

  ui.cargando(true);
  try {
    const actual = temas[indice];
    const adyacente = temas[nuevoIndice];

    const ordenActual = nuevoIndice + 1;
    const ordenAdyacente = indice + 1;

    await Promise.all([
      api.actualizar("temas", actual.id, { orden: ordenActual }),
      api.actualizar("temas", adyacente.id, { orden: ordenAdyacente })
    ]);

    await cargarTemas();
    ui.aviso("Orden de temas actualizado", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al mover el tema", "error");
  } finally {
    ui.cargando(false);
  }
}

async function toggleEstadoTema(id) {
  const tema = temas.find((t) => t.id === id);
  if (!tema) return;

  const nuevoEstado = tema.estado === "publicado" ? "borrador" : "publicado";

  ui.cargando(true);
  try {
    await api.actualizar("temas", id, { estado: nuevoEstado });
    tema.estado = nuevoEstado;
    renderizarTemas();
    ui.aviso(`Tema marcado como ${nuevoEstado}`, "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar estado del tema", "error");
  } finally {
    ui.cargando(false);
  }
}

async function eliminarTema(id) {
  const tema = temas.find((t) => t.id === id);
  if (!tema) return;

  const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar el tema "${tema.titulo}"?`);
  if (!confirmado) return;

  ui.cargando(true);
  try {
    await api.eliminar("temas", id);
    ui.aviso("Tema eliminado correctamente", "exito");
    await cargarTemas();
  } catch (err) {
    ui.aviso(err.message || "Error al eliminar el tema", "error");
  } finally {
    ui.cargando(false);
  }
}

// -------------------------------------------------------------------
// MODALES: CONFIGURACIÓN Y FORMULARIOS
// -------------------------------------------------------------------

function configurarModales() {
  // Modal Unidad
  btnCerrarModalUnidad.addEventListener("click", cerrarModalUnidad);
  btnCancelarUnidad.addEventListener("click", cerrarModalUnidad);
  formUnidad.addEventListener("submit", guardarUnidad);

  // Modal Tema
  btnCerrarModalTema.addEventListener("click", cerrarModalTema);
  btnCancelarTema.addEventListener("click", cerrarModalTema);
  formTema.addEventListener("submit", guardarTema);

  // Cerrar al pulsar Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modalUnidad.style.display !== "none") cerrarModalUnidad();
      if (modalTema.style.display !== "none") cerrarModalTema();
    }
  });
}

function abrirModalUnidad(unidad = null) {
  unidadEnEdicion = unidad;
  errorTituloUnidad.style.display = "none";
  errorTituloUnidad.textContent = "";

  if (unidad) {
    tituloModalUnidad.textContent = "Renombrar Unidad";
    inputTituloUnidad.value = unidad.titulo || "";
  } else {
    tituloModalUnidad.textContent = "Nueva Unidad";
    inputTituloUnidad.value = "";
  }

  modalUnidad.style.display = "flex";
  setTimeout(() => inputTituloUnidad.focus(), 50);
}

function cerrarModalUnidad() {
  modalUnidad.style.display = "none";
  unidadEnEdicion = null;
  formUnidad.reset();
}

async function guardarUnidad(e) {
  e.preventDefault();
  const titulo = inputTituloUnidad.value.trim();

  if (!titulo) {
    errorTituloUnidad.textContent = "El título de la unidad es obligatorio.";
    errorTituloUnidad.style.display = "block";
    inputTituloUnidad.focus();
    return;
  }

  ui.cargando(true);
  try {
    if (unidadEnEdicion) {
      // Renombrar
      await api.actualizar("unidades", unidadEnEdicion.id, { titulo });
      ui.aviso("Unidad renombrada correctamente", "exito");
    } else {
      // Agregar nueva
      const maxOrden = unidades.reduce((max, u) => Math.max(max, Number(u.orden) || 0), 0);
      const nueva = await api.crear("unidades", {
        asignaturaId: asignaturaSeleccionadaId,
        titulo,
        orden: maxOrden + 1,
        visible: true
      });
      unidadSeleccionadaId = nueva.id;
      ui.aviso("Unidad creada correctamente", "exito");
    }

    cerrarModalUnidad();
    await cargarUnidades();
  } catch (err) {
    errorTituloUnidad.textContent = err.message || "Error al guardar la unidad";
    errorTituloUnidad.style.display = "block";
  } finally {
    ui.cargando(false);
  }
}

function abrirModalTema() {
  if (!unidadSeleccionadaId) {
    ui.aviso("Debes seleccionar una unidad primero", "advertencia");
    return;
  }

  errorTituloTema.style.display = "none";
  errorTituloTema.textContent = "";
  inputTituloTema.value = "";

  modalTema.style.display = "flex";
  setTimeout(() => inputTituloTema.focus(), 50);
}

function cerrarModalTema() {
  modalTema.style.display = "none";
  formTema.reset();
}

async function guardarTema(e) {
  e.preventDefault();
  const titulo = inputTituloTema.value.trim();

  if (!titulo) {
    errorTituloTema.textContent = "El título del tema es obligatorio.";
    errorTituloTema.style.display = "block";
    inputTituloTema.focus();
    return;
  }

  ui.cargando(true);
  try {
    const maxOrden = temas.reduce((max, t) => Math.max(max, Number(t.orden) || 0), 0);
    await api.crear("temas", {
      unidadId: unidadSeleccionadaId,
      titulo,
      orden: maxOrden + 1,
      estado: "borrador"
    });

    ui.aviso("Tema creado en borrador", "exito");
    cerrarModalTema();
    await cargarTemas();
  } catch (err) {
    errorTituloTema.textContent = err.message || "Error al guardar el tema";
    errorTituloTema.style.display = "block";
  } finally {
    ui.cargando(false);
  }
}
