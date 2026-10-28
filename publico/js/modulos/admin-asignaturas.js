// publico/js/modulos/admin-asignaturas.js · Gestión y CRUD de asignaturas para administradores
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Asignaturas", roles: ["admin"] });

const gridAsignaturas = document.getElementById("gridAsignaturas");
const btnNuevaAsignatura = document.getElementById("btnNuevaAsignatura");

let asignaturas = [];
let distributivo = [];

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [listaAsignaturas, listaDistributivo] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("distributivo")
    ]);
    asignaturas = listaAsignaturas;
    distributivo = listaDistributivo;
    renderizarAsignaturas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las asignaturas", "error");
    gridAsignaturas.innerHTML = `<div class="tarjeta texto-centro">No se pudieron cargar las asignaturas.</div>`;
  } finally {
    ui.cargando(false);
  }
}

function renderizarAsignaturas() {
  if (asignaturas.length === 0) {
    gridAsignaturas.innerHTML = `
      <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
        <p>No hay asignaturas registradas actualmente.</p>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimera" style="margin-top: var(--espacio-s);">
          Crear primera asignatura
        </button>
      </div>
    `;
    const btnPrimera = document.getElementById("btnCrearPrimera");
    if (btnPrimera) btnPrimera.addEventListener("click", () => abrirModalAsignatura());
    return;
  }

  gridAsignaturas.innerHTML = asignaturas.map((a) => {
    const gruposAsig = distributivo.filter((g) => g.asignaturaId === a.id);
    const cantGrupos = gruposAsig.length;
    const textoGrupos = cantGrupos === 1 ? "1 grupo asignado" : `${cantGrupos} grupos asignados`;

    return `
      <article class="tarjeta tarjeta-asignatura" data-id="${ui.escapar(a.id)}">
        <div class="tarjeta-asignatura__cabecera">
          <h2 class="tarjeta-asignatura__titulo">${ui.escapar(a.nombre || "Sin nombre")}</h2>
          <span class="insignia insignia--secundario">${ui.escapar(a.nivel || "Nivel no definido")}</span>
        </div>

        <p class="tarjeta-asignatura__descripcion">${ui.escapar(a.descripcion || "Sin descripción")}</p>

        <footer class="tarjeta-asignatura__pie">
          <span class="tarjeta-asignatura__grupos">${ui.escapar(textoGrupos)}</span>
          <div class="tarjeta-asignatura__acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(a.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(a.id)}" data-nombre="${ui.escapar(a.nombre || "")}" data-grupos="${cantGrupos}">
              Eliminar
            </button>
          </div>
        </footer>
      </article>
    `;
  }).join("");

  asignarEventos();
}

function asignarEventos() {
  gridAsignaturas.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const asignatura = asignaturas.find((a) => a.id === id);
      if (asignatura) abrirModalAsignatura(asignatura);
    });
  });

  gridAsignaturas.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const nombre = btn.getAttribute("data-nombre");
      const cantGrupos = parseInt(btn.getAttribute("data-grupos") || "0", 10);

      // Regla de negocio: solo eliminar si no tiene grupos
      if (cantGrupos > 0) {
        ui.aviso(
          `No se puede eliminar la asignatura "${nombre}" porque tiene ${cantGrupos} grupo(s) asignado(s) en el distributivo.`,
          "advertencia"
        );
        return;
      }

      const confirmado = await ui.confirmar(`¿Estás seguro de eliminar la asignatura "${nombre}"?`);
      if (!confirmado) return;

      ui.cargando(true);
      try {
        await api.eliminar("asignaturas", id);
        ui.aviso("Asignatura eliminada con éxito", "exito");
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || "Error al eliminar la asignatura", "error");
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function abrirModalAsignatura(asignatura = null) {
  const esEdicion = !!asignatura;
  const contenedor = document.createElement("form");
  contenedor.className = "form-modal-asignatura pila";
  contenedor.noValidate = true;

  contenedor.innerHTML = `
    <div class="campo" id="grupoModalNombre">
      <label for="modalNombre">Nombre de la asignatura</label>
      <input type="text" id="modalNombre" required value="${ui.escapar(asignatura?.nombre || "")}" placeholder="Ej. Competencias Digitales">
      <span class="campo__error" id="errorModalNombre" aria-live="polite"></span>
    </div>

    <div class="campo" id="grupoModalNivel">
      <label for="modalNivel">Nivel académico</label>
      <select id="modalNivel" required>
        <option value="PREGRADO" ${asignatura?.nivel === "PREGRADO" ? "selected" : ""}>Pregrado</option>
        <option value="MAESTRÍA" ${asignatura?.nivel === "MAESTRÍA" || !esEdicion ? "selected" : ""}>Maestría</option>
        <option value="DOCTORADO" ${asignatura?.nivel === "DOCTORADO" ? "selected" : ""}>Doctorado</option>
        <option value="DIPLOMADO" ${asignatura?.nivel === "DIPLOMADO" ? "selected" : ""}>Diplomado</option>
      </select>
      <span class="campo__error" id="errorModalNivel" aria-live="polite"></span>
    </div>

    <div class="campo" id="grupoModalDescripcion">
      <label for="modalDescripcion">Descripción general</label>
      <textarea id="modalDescripcion" rows="3" required placeholder="Descripción de los contenidos y objetivos...">${ui.escapar(asignatura?.descripcion || "")}</textarea>
      <span class="campo__error" id="errorModalDescripcion" aria-live="polite"></span>
    </div>
  `;

  ui.modal({
    titulo: esEdicion ? "Editar Asignatura" : "Nueva Asignatura",
    contenido: contenedor,
    acciones: [
      { texto: "Cancelar", valor: false, tipo: "secundario" },
      { texto: esEdicion ? "Guardar cambios" : "Crear asignatura", valor: true, tipo: "primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;

    const inputNombre = contenedor.querySelector("#modalNombre");
    const selectNivel = contenedor.querySelector("#modalNivel");
    const inputDesc = contenedor.querySelector("#modalDescripcion");

    const nombre = inputNombre.value.trim();
    const nivel = selectNivel.value;
    const descripcion = inputDesc.value.trim();

    if (!nombre) {
      ui.aviso("El nombre de la asignatura es obligatorio", "error");
      return;
    }

    if (!descripcion) {
      ui.aviso("La descripción es obligatoria", "error");
      return;
    }

    ui.cargando(true);
    try {
      const datos = { nombre, nivel, descripcion };
      if (esEdicion) {
        await api.actualizar("asignaturas", asignatura.id, datos);
        ui.aviso("Asignatura actualizada con éxito", "exito");
      } else {
        await api.crear("asignaturas", datos);
        ui.aviso("Asignatura creada con éxito", "exito");
      }
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "Error al guardar la asignatura", "error");
    } finally {
      ui.cargando(false);
    }
  });
}

btnNuevaAsignatura.addEventListener("click", () => abrirModalAsignatura());

await cargarDatos();
