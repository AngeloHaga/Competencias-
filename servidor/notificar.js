// servidor/notificar.js · Envío de notificaciones internas
import * as almacen from "./almacen.js";

/**
 * Registra una notificación para un usuario
 * @param {string} usuarioId
 * @param {Object} datos { tipo, mensaje, enlace }
 * @returns {Promise<Object>}
 */
export async function notificar(usuarioId, { tipo = "sistema", mensaje = "", enlace = "" } = {}) {
  if (!usuarioId) return null;
  return await almacen.agregar("notificaciones", {
    usuarioId,
    tipo,
    mensaje,
    enlace,
    leida: false
  });
}
