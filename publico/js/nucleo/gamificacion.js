// publico/js/nucleo/gamificacion.js · Cliente de gamificación para el navegador
import * as api from "./api.js";
import * as ui from "./ui.js";

/**
 * Registra un intento de actividad en el servidor, obtiene recompensas y muestra logros
 * @param {Object} datos { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(datos) {
  const resultado = await api.llamar("POST", "/api/intentos", datos);
  await mostrarLogros(resultado);
  return resultado;
}

/**
 * Muestra logros: ui.aviso con puntos ganados (> 0), un modal de celebración
 * por cada insignia nueva y actualiza el contador #puntos-usuario
 * @param {Object} resultado { puntosGanados, puntosTotales, insigniasNuevas }
 */
export async function mostrarLogros(resultado) {
  if (!resultado) return;

  const puntosGanados = Number(resultado.puntosGanados) || 0;
  const puntosTotales = resultado.puntosTotales !== undefined ? Number(resultado.puntosTotales) : null;
  const insignias = Array.isArray(resultado.insigniasNuevas) ? resultado.insigniasNuevas : [];

  // Actualizar indicador #puntos-usuario si está presente en el encabezado
  if (puntosTotales !== null) {
    actualizarPuntosUsuarioDOM(puntosTotales);
  } else if (puntosGanados > 0) {
    const elPuntos = document.getElementById("puntos-usuario");
    if (elPuntos) {
      const numActual = parseInt(elPuntos.dataset.puntos || elPuntos.textContent, 10);
      if (!isNaN(numActual)) {
        actualizarPuntosUsuarioDOM(numActual + puntosGanados);
      }
    }
  }

  // Notificar puntos ganados si son más de 0
  if (puntosGanados > 0) {
    ui.aviso(`+${puntosGanados} puntos ganados 🌟`, "exito");
  }

  // Mostrar un modal de celebración por cada insignia nueva secuencialmente
  for (const ins of insignias) {
    const contenedor = document.createElement("div");
    contenedor.className = "celebracion";
    contenedor.innerHTML = `
      <div class="celebracion__icono-wrap">
        <span class="celebracion__icono" role="img" aria-label="Insignia">${ui.escapar(ins.icono || "🎖️")}</span>
      </div>
      <h3 class="celebracion__nombre">${ui.escapar(ins.nombre || "Nueva insignia")}</h3>
      ${ins.descripcion ? `<p class="celebracion__descripcion">${ui.escapar(ins.descripcion)}</p>` : ""}
    `;

    await ui.modal({
      titulo: "¡Nueva insignia desbloqueada!",
      contenido: contenedor,
      acciones: [{ texto: "¡Genial!", tipo: "principal", valor: true }]
    });
  }
}

/**
 * Actualiza el contador de puntos en el DOM (#puntos-usuario)
 * @param {number} valor
 */
export function actualizarPuntosUsuarioDOM(valor) {
  const elPuntos = document.getElementById("puntos-usuario");
  if (!elPuntos) return;
  elPuntos.dataset.puntos = String(valor);

  const spanValor = elPuntos.querySelector(".puntos-usuario__valor");
  if (spanValor) {
    spanValor.textContent = `${valor} pts`;
  } else {
    elPuntos.textContent = `⭐ ${valor} pts`;
  }
}

/**
 * Consulta los logros e insignias de un usuario
 * @param {string} [usuarioId="yo"]
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = "yo") {
  return await api.llamar("GET", `/api/logros/${encodeURIComponent(usuarioId)}`);
}

