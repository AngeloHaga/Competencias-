// publico/js/nucleo/bitacora.js · Registro de eventos en la bitácora
import * as api from "./api.js";

/**
 * Registra un evento en la bitácora del sistema
 * @param {string} tipo - Tipo de evento (ej. "pagina", "actividad", "login")
 * @param {string} recurso - Recurso sobre el que ocurre el evento (ej. ruta, identificador)
 * @returns {Promise<Object|void>}
 */
export async function registrarEvento(tipo, recurso) {
  try {
    return await api.llamar("POST", "/api/eventos", { tipo, recurso });
  } catch (err) {
    // Falla silenciosa para no interrumpir la experiencia de usuario
    console.warn("No se pudo registrar el evento en bitácora:", err);
  }
}
