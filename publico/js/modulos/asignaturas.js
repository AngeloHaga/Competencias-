// publico/js/modulos/asignaturas.js · Vista de asignaturas del estudiante con avance
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

const gridAsignaturas = document.getElementById("gridAsignaturas");

/**
 * Calcula el avance (% de temas publicados revisados) de una asignatura
 * @param {string} asignaturaId
 * @returns {Promise<{ porcentaje: number, revisados: number, total: number }>}
 */
export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progreso] = await Promise.all([
      api.listar("unidades", { asignaturaId }),
      api.listar("temas"),
      api.listar("progreso-temas")
    ]);

    const idsUnidadesVisibles = new Set(
      unidades.filter((u) => u.visible !== false).map((u) => u.id)
    );

    const temasPublicados = temas.filter(
      (t) => t.estado === "publicado" && idsUnidadesVisibles.has(t.unidadId)
    );

    const total = temasPublicados.length;
    if (total === 0) {
      return { porcentaje: 0, revisados: 0, total: 0, valueOf() { return 0; } };
    }

    const idsProgreso = new Set(progreso.map((p) => p.temaId));
    const revisados = temasPublicados.filter((t) => idsProgreso.has(t.id)).length;
    const porcentaje = Math.round((revisados / total) * 100);

    return {
      porcentaje,
      revisados,
      total,
      valueOf() {
        return this.porcentaje;
      },
      toString() {
        return String(this.porcentaje);
      }
    };
  } catch (err) {
    console.error("Error al calcular avance:", err);
    return { porcentaje: 0, revisados: 0, total: 0, valueOf() { return 0; } };
  }
}

async function cargarAsignaturas() {
  ui.cargando(true);
  try {
    const [asignaturas, unidades, temas, progreso] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("unidades"),
      api.listar("temas"),
      api.listar("progreso-temas")
    ]);

    if (asignaturas.length === 0) {
      gridAsignaturas.innerHTML = `
        <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
          <p>No tienes asignaturas registradas actualmente en tu distributivo.</p>
        </div>
      `;
      return;
    }

    const idsProgreso = new Set(progreso.map((p) => p.temaId));

    gridAsignaturas.innerHTML = asignaturas
      .map((asig) => {
        // Unidades visibles de esta asignatura
        const idsUnidadesVisibles = new Set(
          unidades
            .filter((u) => u.asignaturaId === asig.id && u.visible !== false)
            .map((u) => u.id)
        );

        // Temas publicados en esas unidades
        const temasPublicados = temas.filter(
          (t) => t.estado === "publicado" && idsUnidadesVisibles.has(t.unidadId)
        );

        const total = temasPublicados.length;
        const revisados = total > 0 ? temasPublicados.filter((t) => idsProgreso.has(t.id)).length : 0;
        const porcentaje = total > 0 ? Math.round((revisados / total) * 100) : 0;

        return `
          <article class="tarjeta tarjeta-estudiante-asig">
            <div>
              <div class="tarjeta-estudiante-asig__cabecera">
                <h2 class="tarjeta-estudiante-asig__titulo">${ui.escapar(asig.nombre || "Sin nombre")}</h2>
                <span class="insignia insignia--secundario">${ui.escapar(asig.nivel || "Nivel")}</span>
              </div>
              <p class="tarjeta-estudiante-asig__descripcion" style="margin-top: var(--espacio-s);">
                ${ui.escapar(asig.descripcion || "Sin descripción disponible.")}
              </p>
            </div>

            <div class="tarjeta-estudiante-asig__avance">
              <div class="tarjeta-estudiante-asig__avance-fila">
                <span>Avance de temas</span>
                <span class="tarjeta-estudiante-asig__avance-porcentaje">${porcentaje}% (${revisados}/${total})</span>
              </div>
              <div class="progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Porcentaje de avance en ${ui.escapar(asig.nombre)}">
                <span style="width: ${porcentaje}%;"></span>
              </div>

              <div style="margin-top: var(--espacio-s); text-align: right;">
                <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario btn--pequeno" style="width: 100%;">
                  Ver contenido del curso →
                </a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las asignaturas", "error");
    gridAsignaturas.innerHTML = `<div class="tarjeta texto-centro">No se pudieron cargar tus asignaturas.</div>`;
  } finally {
    ui.cargando(false);
  }
}

if (gridAsignaturas) {
  await montarPlantilla({ titulo: "Mis asignaturas", roles: ["estudiante", "docente"] });
  await cargarAsignaturas();
}
