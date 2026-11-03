// publico/js/modulos/admin-asignaturas.js · Gestión y CRUD de asignaturas y niveles para docentes y administradores
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Asignaturas", roles: ["docente", "admin"] });

/**
 * Catálogo completo de niveles educativos (Escuela, Colegio y Educación Superior)
 */
export const NIVELES_ACADEMICOS = [
  {
    grupo: "Educación Básica (Escuela - EGB)",
    opciones: [
      { valor: "Educación Inicial / Preescolar", texto: "Educación Inicial / Preescolar (3 a 5 años)" },
      { valor: "1.° de Básica (Preparatoria)", texto: "1.° de Básica (Preparatoria)" },
      { valor: "2.° de Básica (Elemental)", texto: "2.° de Básica (Elemental)" },
      { valor: "3.° de Básica (Elemental)", texto: "3.° de Básica (Elemental)" },
      { valor: "4.° de Básica (Elemental)", texto: "4.° de Básica (Elemental)" },
      { valor: "5.° de Básica (Media)", texto: "5.° de Básica (Media)" },
      { valor: "6.° de Básica (Media)", texto: "6.° de Básica (Media)" },
      { valor: "7.° de Básica (Media)", texto: "7.° de Básica (Media)" },
      { valor: "8.° de Básica (Superior)", texto: "8.° de Básica (Superior)" },
      { valor: "9.° de Básica (Superior)", texto: "9.° de Básica (Superior)" },
      { valor: "10.° de Básica (Superior)", texto: "10.° de Básica (Superior)" },
      { valor: "EGB Subnivel Elemental", texto: "EGB Subnivel Elemental (2.° a 4.°)" },
      { valor: "EGB Subnivel Medio", texto: "EGB Subnivel Medio (5.° a 7.°)" },
      { valor: "EGB Subnivel Superior", texto: "EGB Subnivel Superior (8.° a 10.°)" },
      { valor: "Educación General Básica (EGB)", texto: "Educación General Básica (EGB General)" }
    ]
  },
  {
    grupo: "Bachillerato (Colegio - BGU)",
    opciones: [
      { valor: "1.° de Bachillerato", texto: "1.° de Bachillerato" },
      { valor: "2.° de Bachillerato", texto: "2.° de Bachillerato" },
      { valor: "3.° de Bachillerato", texto: "3.° de Bachillerato" },
      { valor: "Bachillerato General Unificado (BGU)", texto: "Bachillerato General Unificado (BGU)" },
      { valor: "Bachillerato en Ciencias", texto: "Bachillerato en Ciencias" },
      { valor: "Bachillerato Técnico", texto: "Bachillerato Técnico" },
      { valor: "Bachillerato Internacional", texto: "Bachillerato Internacional (BI)" }
    ]
  },
  {
    grupo: "Educación Superior y Posgrados",
    opciones: [
      { valor: "Técnico / Tecnológico Superior", texto: "Técnico / Tecnológico Superior" },
      { valor: "Pregrado", texto: "Pregrado (Licenciatura / Ingeniería)" },
      { valor: "Maestría", texto: "Maestría" },
      { valor: "Doctorado", texto: "Doctorado (PhD)" },
      { valor: "Diplomado", texto: "Diplomado / Formación Continua" }
    ]
  }
];

function generarOpcionesNivel(nivelActual) {
  const normActual = String(nivelActual || "").trim().toUpperCase();
  let html = `<option value="" disabled ${!nivelActual ? "selected" : ""}>Selecciona el nivel académico...</option>`;
  let coincidencia = false;

  for (const grupo of NIVELES_ACADEMICOS) {
    html += `<optgroup label="${ui.escapar(grupo.grupo)}">`;
    for (const op of grupo.opciones) {
      const normOp = op.valor.trim().toUpperCase();
      let match = normActual === normOp;

      // Compatibilidad retroactiva con valores en mayúsculas
      if (!match) {
        if (normActual === "PREGRADO" && normOp === "PREGRADO") match = true;
        if (normActual === "MAESTRÍA" && normOp === "MAESTRÍA") match = true;
        if (normActual === "DOCTORADO" && normOp === "DOCTORADO") match = true;
        if (normActual === "DIPLOMADO" && normOp === "DIPLOMADO") match = true;
      }

      if (match) coincidencia = true;
      html += `<option value="${ui.escapar(op.valor)}" ${match ? "selected" : ""}>${ui.escapar(op.texto)}</option>`;
    }
    html += `</optgroup>`;
  }

  // Si existe un valor previo personalizado fuera de la lista estándar, mantenerlo seleccionado
  if (nivelActual && !coincidencia) {
    html = `<option value="${ui.escapar(nivelActual)}" selected>${ui.escapar(nivelActual)} (Personalizado)</option>` + html;
  }

  return html;
}

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

      // Regla de negocio: solo bloquear eliminación si tiene estudiantes inscritos
      const gruposAsig = distributivo.filter((g) => g.asignaturaId === id);
      const tieneEstudiantes = gruposAsig.some(
        (g) => Array.isArray(g.estudiantes) && g.estudiantes.length > 0
      );

      if (tieneEstudiantes) {
        ui.aviso(
          `No se puede eliminar la asignatura "${nombre}" porque tiene estudiantes inscritos en el distributivo académico.`,
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
        ${generarOpcionesNivel(asignatura?.nivel)}
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

    if (!nivel) {
      ui.aviso("Debes seleccionar el nivel académico de la asignatura", "error");
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
