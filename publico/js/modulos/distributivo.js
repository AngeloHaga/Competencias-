// publico/js/modulos/distributivo.js · Gestión del distributivo académico para administradores
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Distributivo", roles: ["admin"] });

const cuerpoTabla = document.getElementById("cuerpoTablaDistributivo");
const btnNuevoGrupo = document.getElementById("btnNuevoGrupo");

let distributivo = [];
let asignaturas = [];
let usuarios = [];

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [listaDist, listaAsig, listaUsu] = await Promise.all([
      api.listar("distributivo"),
      api.listar("asignaturas"),
      api.listar("usuarios")
    ]);
    distributivo = listaDist;
    asignaturas = listaAsig;
    usuarios = listaUsu;
    renderizarTabla();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el distributivo", "error");
    cuerpoTabla.innerHTML = `<tr><td colspan="6" class="texto-centro">No se pudieron cargar los datos.</td></tr>`;
  } finally {
    ui.cargando(false);
  }
}

function renderizarTabla() {
  if (distributivo.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="6" class="texto-centro">No hay grupos configurados en el distributivo.</td>
      </tr>
    `;
    return;
  }

  const mapaAsig = new Map(asignaturas.map((a) => [a.id, a]));
  const mapaUsu = new Map(usuarios.map((u) => [u.id, u]));

  cuerpoTabla.innerHTML = distributivo.map((g) => {
    const asig = mapaAsig.get(g.asignaturaId);
    const nombreAsig = asig ? asig.nombre : "Asignatura desconocida";
    const nivelAsig = asig ? asig.nivel : "";

    const docente = mapaUsu.get(g.docenteId);
    const nombreDocente = docente
      ? `${docente.nombre} ${docente.apellido}`
      : "Docente no asignado";

    const cantEst = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

    return `
      <tr data-id="${ui.escapar(g.id)}">
        <td>
          <strong>${ui.escapar(nombreAsig)}</strong>
          ${nivelAsig ? `<br><small class="texto-suave">${ui.escapar(nivelAsig)}</small>` : ""}
        </td>
        <td><span class="insignia insignia--secundario">${ui.escapar(g.paralelo || "—")}</span></td>
        <td>${ui.escapar(g.periodo || "—")}</td>
        <td>${ui.escapar(nombreDocente)}</td>
        <td>
          <span class="insignia insignia--info">${cantEst} ${cantEst === 1 ? "estudiante" : "estudiantes"}</span>
        </td>
        <td class="texto-derecha">
          <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(g.id)}">
            Editar
          </button>
          <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(g.id)}" data-info="${ui.escapar(`${nombreAsig} - Paralelo ${g.paralelo}`)}">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join("");

  asignarEventos();
}

function asignarEventos() {
  cuerpoTabla.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const grupo = distributivo.find((g) => g.id === id);
      if (grupo) abrirModalGrupo(grupo);
    });
  });

  cuerpoTabla.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const info = btn.getAttribute("data-info");

      const confirmado = await ui.confirmar(`¿Estás seguro de eliminar el grupo "${info}" del distributivo?`);
      if (!confirmado) return;

      ui.cargando(true);
      try {
        await api.eliminar("distributivo", id);
        ui.aviso("Grupo eliminado con éxito", "exito");
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || "Error al eliminar el grupo", "error");
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function abrirModalGrupo(grupo = null) {
  const esEdicion = !!grupo;
  const docentes = usuarios.filter((u) => u.rol === "docente");
  const estudiantes = usuarios.filter((u) => u.rol === "estudiante");

  const seleccionados = new Set(Array.isArray(grupo?.estudiantes) ? grupo.estudiantes : []);

  const contenedor = document.createElement("form");
  contenedor.className = "form-modal-distributivo pila";
  contenedor.noValidate = true;

  const opcionesAsignaturas = asignaturas.map((a) => {
    const sel = grupo?.asignaturaId === a.id ? "selected" : "";
    return `<option value="${ui.escapar(a.id)}" ${sel}>${ui.escapar(a.nombre)} (${ui.escapar(a.nivel)})</option>`;
  }).join("");

  const opcionesDocentes = docentes.map((d) => {
    const sel = grupo?.docenteId === d.id ? "selected" : "";
    return `<option value="${ui.escapar(d.id)}" ${sel}>${ui.escapar(d.nombre)} ${ui.escapar(d.apellido)} (${ui.escapar(d.correo)})</option>`;
  }).join("");

  const itemsEstudiantesHtml = estudiantes.map((est) => {
    const check = seleccionados.has(est.id) ? "checked" : "";
    const textoBusqueda = `${est.nombre} ${est.apellido} ${est.correo}`.toLowerCase();
    return `
      <label class="item-estudiante" data-busqueda="${ui.escapar(textoBusqueda)}">
        <input type="checkbox" value="${ui.escapar(est.id)}" class="check-estudiante-item" ${check}>
        <div class="item-estudiante-info">
          <span class="item-estudiante-nombre">${ui.escapar(est.nombre)} ${ui.escapar(est.apellido)}</span>
          <span class="item-estudiante-correo">${ui.escapar(est.correo)}</span>
        </div>
      </label>
    `;
  }).join("");

  const cantInicial = seleccionados.size;

  contenedor.innerHTML = `
    <div class="campo">
      <label for="modalAsignatura">Asignatura</label>
      <select id="modalAsignatura" required>
        <option value="">Selecciona una asignatura...</option>
        ${opcionesAsignaturas}
      </select>
    </div>

    <div class="fila-modal">
      <div class="campo">
        <label for="modalParalelo">Paralelo</label>
        <input type="text" id="modalParalelo" value="${ui.escapar(grupo?.paralelo || "A")}" placeholder="Ej. A" required>
      </div>

      <div class="campo">
        <label for="modalPeriodo">Período académico</label>
        <input type="text" id="modalPeriodo" value="${ui.escapar(grupo?.periodo || "2026-2027")}" placeholder="Ej. 2026-2027" required>
      </div>
    </div>

    <div class="campo">
      <label for="modalDocente">Docente responsable</label>
      <select id="modalDocente" required>
        <option value="">Selecciona un docente...</option>
        ${opcionesDocentes}
      </select>
    </div>

    <div class="campo">
      <label>Estudiantes del grupo</label>
      <div class="selector-estudiantes-caja">
        <div class="selector-estudiantes-cabecera">
          <input type="search" id="buscadorEstudiantesModal" placeholder="Buscar por nombre o correo..." style="min-height: 32px; font-size: var(--tamano-xs);">
          <span class="insignia insignia--secundario" id="conteoEstudiantesBadge">
            ${cantInicial} ${cantInicial === 1 ? "seleccionado" : "seleccionados"}
          </span>
        </div>
        <div class="lista-estudiantes-scroll" id="listaEstudiantesScroll">
          ${itemsEstudiantesHtml || "<p class='texto-centro texto-suave'>No hay estudiantes registrados</p>"}
        </div>
      </div>
    </div>
  `;

  // Interacción del buscador y selección de estudiantes
  const buscador = contenedor.querySelector("#buscadorEstudiantesModal");
  const badgeConteo = contenedor.querySelector("#conteoEstudiantesBadge");
  const listaScroll = contenedor.querySelector("#listaEstudiantesScroll");

  function actualizarConteo() {
    const cant = seleccionados.size;
    badgeConteo.textContent = `${cant} ${cant === 1 ? "seleccionado" : "seleccionados"}`;
  }

  listaScroll.querySelectorAll(".check-estudiante-item").forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.value;
      if (chk.checked) {
        seleccionados.add(id);
      } else {
        seleccionados.delete(id);
      }
      actualizarConteo();
    });
  });

  buscador.addEventListener("input", () => {
    const termino = buscador.value.trim().toLowerCase();
    listaScroll.querySelectorAll(".item-estudiante").forEach((item) => {
      const texto = item.getAttribute("data-busqueda") || "";
      item.style.display = texto.includes(termino) ? "flex" : "none";
    });
  });

  ui.modal({
    titulo: esEdicion ? "Editar Grupo del Distributivo" : "Nuevo Grupo en Distributivo",
    contenido: contenedor,
    acciones: [
      { texto: "Cancelar", valor: false, tipo: "secundario" },
      { texto: esEdicion ? "Guardar cambios" : "Crear grupo", valor: true, tipo: "primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;

    const asignaturaId = contenedor.querySelector("#modalAsignatura").value;
    const paralelo = contenedor.querySelector("#modalParalelo").value.trim().toUpperCase();
    const periodo = contenedor.querySelector("#modalPeriodo").value.trim();
    const docenteId = contenedor.querySelector("#modalDocente").value;

    if (!asignaturaId) {
      ui.aviso("Debes seleccionar una asignatura", "error");
      return;
    }
    if (!paralelo) {
      ui.aviso("El paralelo es obligatorio", "error");
      return;
    }
    if (!periodo) {
      ui.aviso("El período académico es obligatorio", "error");
      return;
    }
    if (!docenteId) {
      ui.aviso("Debes seleccionar un docente para el grupo", "error");
      return;
    }

    const datosGrupo = {
      asignaturaId,
      paralelo,
      periodo,
      docenteId,
      estudiantes: Array.from(seleccionados)
    };

    ui.cargando(true);
    try {
      if (esEdicion) {
        await api.actualizar("distributivo", grupo.id, datosGrupo);
        ui.aviso("Grupo actualizado con éxito", "exito");
      } else {
        await api.crear("distributivo", datosGrupo);
        ui.aviso("Grupo creado con éxito", "exito");
      }
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "Error al guardar el grupo en distributivo", "error");
    } finally {
      ui.cargando(false);
    }
  });
}

btnNuevoGrupo.addEventListener("click", () => abrirModalGrupo());

await cargarDatos();
