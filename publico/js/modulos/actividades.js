// publico/js/modulos/actividades.js · Vista del catálogo de actividades
import { montarPlantilla } from "../nucleo/plantilla.js";
import { ACTIVIDADES } from "../nucleo/catalogo-actividades.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Actividades", roles: ["estudiante", "docente"] });

const grid = document.getElementById("gridActividades");

const ICONOS = {
  ahorcado: "🔤",
  canciones: "🎵",
  quiz: "🏆",
  pareja: "🧩",
  "sopa-letras": "🔍",
  crucigrama: "✏️",
  simulacion: "🎭"
};

if (grid) {
  if (!Array.isArray(ACTIVIDADES) || ACTIVIDADES.length === 0) {
    grid.innerHTML = `
      <div class="vacio" style="grid-column: 1 / -1;">
        <span class="vacio__icono">🎮</span>
        <h2 class="vacio__titulo">No hay actividades disponibles</h2>
        <p class="vacio__descripcion">Pronto se publicarán nuevas dinámicas de aprendizaje.</p>
      </div>
    `;
  } else {
    grid.innerHTML = ACTIVIDADES.map((act) => {
      const icono = ICONOS[act.id] || "🎯";
      return `
        <article class="tarjeta-actividad">
          <div class="tarjeta-actividad__cuerpo">
            <div class="tarjeta-actividad__icono" aria-hidden="true">${icono}</div>
            <h2 class="tarjeta-actividad__titulo">${ui.escapar(act.texto || "Actividad")}</h2>
            <p class="tarjeta-actividad__descripcion">${ui.escapar(act.descripcion || "")}</p>
          </div>
          <div class="tarjeta-actividad__acciones">
            <a href="${ui.escapar(act.href)}" class="btn btn--primario" style="width: 100%;">
              Jugar →
            </a>
          </div>
        </article>
      `;
    }).join("");
  }
}

