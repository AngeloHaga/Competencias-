// publico/js/nucleo/retroalimentacion.js · Retroalimentación formativa y resúmenes de actividad
import * as ui from "./ui.js";

/**
 * Muestra retroalimentación inmediata sobre la respuesta de una pregunta en un panel .retro
 * @param {Object} opciones { correcto, explicacion, sugerencia, enlaceTema }
 * @returns {HTMLElement} Elemento DOM del panel .retro insertado o listo
 */
export function mostrarRetro({ correcto, explicacion = "", sugerencia = "", enlaceTema = "" }) {
  const panel = document.createElement("div");
  panel.className = `retro retro--${correcto ? "correcto" : "incorrecto"}`;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const icono = correcto ? "🎉" : "❌";
  const titulo = correcto ? "¡Correcto!" : "Incorrecto";

  let htmlCuerpo = `
    <h4 class="retro__titulo">${titulo}</h4>
  `;

  if (explicacion) {
    htmlCuerpo += `<p class="retro__explicacion">${ui.limpiar(explicacion)}</p>`;
  }

  if (sugerencia) {
    htmlCuerpo += `<p class="retro__sugerencia">💡 ${ui.escapar(sugerencia)}</p>`;
  }

  if (enlaceTema) {
    htmlCuerpo += `
      <a href="${ui.escapar(enlaceTema)}" class="retro__enlace" target="_blank" rel="noopener noreferrer">
        📖 Repasar el tema
      </a>
    `;
  }

  panel.innerHTML = `
    <span class="retro__icono" aria-hidden="true">${icono}</span>
    <div class="retro__cuerpo">
      ${htmlCuerpo}
    </div>
  `;

  return panel;
}

/**
 * Muestra el resumen formativo al culminar un intento de evaluación o actividad en un modal
 * @param {Object} opciones { titulo, aciertos, errores, recomendaciones, enlaceTema }
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({
  titulo = "Resumen de la Actividad",
  aciertos = 0,
  errores = 0,
  recomendaciones = [],
  enlaceTema = ""
}) {
  return new Promise((resolve) => {
    const contenedor = document.createElement("div");
    contenedor.className = "pila";

    const total = aciertos + errores;
    const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;

    const stats = document.createElement("div");
    stats.style.display = "flex";
    stats.style.gap = "var(--espacio-m)";
    stats.style.justifyContent = "space-around";
    stats.style.margin = "var(--espacio-s) 0";

    stats.innerHTML = `
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-xl); font-weight: var(--peso-extranegrita); color: var(--color-exito);">${aciertos}</span>
        <div class="texto-suave texto-xs">Aciertos</div>
      </div>
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-xl); font-weight: var(--peso-extranegrita); color: var(--color-error);">${errores}</span>
        <div class="texto-suave texto-xs">Errores</div>
      </div>
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-xl); font-weight: var(--peso-extranegrita); color: var(--color-primario);">${porcentaje}%</span>
        <div class="texto-suave texto-xs">Calificación</div>
      </div>
    `;
    contenedor.appendChild(stats);

    if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
      const recTitulo = document.createElement("h4");
      recTitulo.className = "texto-m texto-negrita";
      recTitulo.style.margin = "var(--espacio-s) 0 var(--espacio-xs) 0";
      recTitulo.textContent = "Recomendaciones para repasar:";
      contenedor.appendChild(recTitulo);

      const lista = document.createElement("ul");
      lista.style.paddingLeft = "var(--espacio-l)";
      lista.style.margin = "0 0 var(--espacio-s) 0";
      recomendaciones.forEach((r) => {
        const li = document.createElement("li");
        li.className = "texto-s";
        li.textContent = r;
        lista.appendChild(li);
      });
      contenedor.appendChild(lista);
    }

    if (enlaceTema) {
      const linkDiv = document.createElement("div");
      linkDiv.style.margin = "var(--espacio-xs) 0";
      linkDiv.innerHTML = `
        <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario btn--pequeno" target="_blank" rel="noopener noreferrer">
          📖 Repasar el tema
        </a>
      `;
      contenedor.appendChild(linkDiv);
    }

    ui.modal({
      titulo,
      contenido: contenedor,
      acciones: [
        {
          texto: "Jugar de nuevo",
          tipo: "secundario",
          valor: "repetir"
        },
        {
          texto: "Finalizar",
          tipo: "principal",
          valor: "salir"
        }
      ]
    }).then((val) => resolve(val || "salir"));
  });
}

