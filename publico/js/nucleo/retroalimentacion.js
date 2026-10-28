// publico/js/nucleo/retroalimentacion.js · Retroalimentación formativa y resúmenes de actividad
import * as ui from "./ui.js";

/**
 * Muestra retroalimentación inmediata sobre la respuesta de una pregunta
 * @param {Object} opciones { correcto, explicacion, sugerencia, enlaceTema }
 * @returns {Promise<boolean>}
 */
export async function mostrarRetro({ correcto, explicacion = "", sugerencia = "", enlaceTema = "" }) {
  return new Promise((resolve) => {
    const contenedor = document.createElement("div");
    contenedor.className = "pila";

    const estadoDiv = document.createElement("div");
    estadoDiv.className = `alerta alerta--${correcto ? "exito" : "error"}`;
    estadoDiv.innerHTML = `<strong>${correcto ? "🎉 ¡Respuesta Correcta!" : "❌ Respuesta Incorrecta"}</strong>`;
    contenedor.appendChild(estadoDiv);

    if (explicacion) {
      const pExp = document.createElement("p");
      pExp.className = "texto-base";
      pExp.innerHTML = ui.limpiar(explicacion);
      contenedor.appendChild(pExp);
    }

    if (sugerencia) {
      const pSug = document.createElement("p");
      pSug.className = "texto-suave";
      pSug.textContent = `💡 Sugerencia: ${sugerencia}`;
      contenedor.appendChild(pSug);
    }

    if (!correcto && enlaceTema) {
      const enlace = document.createElement("a");
      enlace.href = enlaceTema;
      enlace.className = "enlace";
      enlace.target = "_blank";
      enlace.textContent = "📖 Repasar contenidos del tema";
      contenedor.appendChild(enlace);
    }

    ui.modal({
      titulo: correcto ? "Excelente" : "Retroalimentación",
      contenido: contenedor,
      acciones: [
        {
          texto: "Continuar",
          tipo: "principal",
          valor: true
        }
      ]
    }).then(() => resolve(true));
  });
}

/**
 * Muestra el resumen formativo al culminar un intento de evaluación o actividad
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
    stats.style.gap = "var(--espacio-md)";
    stats.style.justifyContent = "space-around";
    stats.style.margin = "var(--espacio-sm) 0";

    stats.innerHTML = `
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-texto-2xl); font-weight: bold; color: var(--color-exito);">${aciertos}</span>
        <div class="texto-suave">Aciertos</div>
      </div>
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-texto-2xl); font-weight: bold; color: var(--color-error);">${errores}</span>
        <div class="texto-suave">Errores</div>
      </div>
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-texto-2xl); font-weight: bold; color: var(--color-primario);">${porcentaje}%</span>
        <div class="texto-suave">Calificación</div>
      </div>
    `;
    contenedor.appendChild(stats);

    if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
      const recTitulo = document.createElement("h4");
      recTitulo.className = "texto-h4";
      recTitulo.textContent = "Temas a reforzar:";
      contenedor.appendChild(recTitulo);

      const lista = document.createElement("ul");
      lista.style.paddingLeft = "var(--espacio-lg)";
      recomendaciones.forEach((r) => {
        const li = document.createElement("li");
        li.textContent = r;
        lista.appendChild(li);
      });
      contenedor.appendChild(lista);
    }

    if (enlaceTema) {
      const linkDiv = document.createElement("div");
      linkDiv.style.marginTop = "var(--espacio-xs)";
      linkDiv.innerHTML = `<a href="${ui.escapar(enlaceTema)}" class="enlace" target="_blank">📖 Repasar el tema en el visor de contenidos</a>`;
      contenedor.appendChild(linkDiv);
    }

    ui.modal({
      titulo,
      contenido: contenedor,
      acciones: [
        {
          texto: "Repetir",
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
