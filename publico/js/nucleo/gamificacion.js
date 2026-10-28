// publico/js/nucleo/gamificacion.js · Cliente de gamificación para el navegador
import * as api from "./api.js";
import * as ui from "./ui.js";

/**
 * Registra un intento de actividad en el servidor y obtiene recompensas
 * @param {Object} datos
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(datos) {
  return await api.llamar("POST", "/api/intentos", datos);
}

/**
 * Muestra una celebración visual con los puntos ganados e insignias desbloqueadas
 * @param {Object} resultado { puntosGanados, insigniasNuevas }
 */
export function mostrarLogros(resultado) {
  if (!resultado) return;
  const puntos = Number(resultado.puntosGanados) || 0;
  const insignias = Array.isArray(resultado.insigniasNuevas) ? resultado.insigniasNuevas : [];

  if (puntos === 0 && insignias.length === 0) return;

  const contenedor = document.createElement("div");
  contenedor.className = "pila";
  contenedor.style.textAlign = "center";

  if (puntos > 0) {
    const pDiv = document.createElement("div");
    pDiv.style.margin = "var(--espacio-sm) 0";
    pDiv.innerHTML = `<span style="font-size: var(--tamano-texto-2xl); font-weight: bold; color: var(--color-primario);">+${puntos} Puntos</span>`;
    contenedor.appendChild(pDiv);
  }

  if (insignias.length > 0) {
    const insTitulo = document.createElement("h3");
    insTitulo.className = "texto-h3";
    insTitulo.textContent = "🎖️ ¡Nuevas insignias desbloqueadas!";
    contenedor.appendChild(insTitulo);

    const rejilla = document.createElement("div");
    rejilla.style.display = "flex";
    rejilla.style.gap = "var(--espacio-md)";
    rejilla.style.justifyContent = "center";
    rejilla.style.flexWrap = "wrap";
    rejilla.style.marginTop = "var(--espacio-sm)";

    insignias.forEach((ins) => {
      const tarjeta = document.createElement("div");
      tarjeta.className = "tarjeta";
      tarjeta.style.padding = "var(--espacio-sm)";
      tarjeta.style.minWidth = "120px";
      tarjeta.style.textAlign = "center";
      tarjeta.innerHTML = `
        <div style="font-size: 2.5rem;">${ins.icono || "🏅"}</div>
        <strong style="display: block; margin-top: var(--espacio-2xs); font-size: var(--tamano-texto-sm);">${ui.escapar(ins.nombre)}</strong>
      `;
      rejilla.appendChild(tarjeta);
    });
    contenedor.appendChild(rejilla);
  }

  ui.modal({
    titulo: "¡Felicitaciones!",
    contenido: contenedor,
    acciones: [{ texto: "¡Genial!", tipo: "principal", valor: true }]
  });
}

/**
 * Consulta los logros e insignias de un usuario
 * @param {string} [usuarioId="yo"]
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = "yo") {
  return await api.llamar("GET", `/api/logros/${encodeURIComponent(usuarioId)}`);
}
