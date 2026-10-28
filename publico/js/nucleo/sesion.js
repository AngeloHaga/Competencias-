// publico/js/nucleo/sesion.js · Gestión de sesión de usuario en el navegador
import * as api from "./api.js";

/**
 * Obtiene el token de autenticación actual
 * @returns {string|null}
 */
export function token() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem("token");
}

/**
 * Obtiene los datos del usuario en sesión
 * @returns {{ id: string, nombre: string, apellido: string, rol: string }|null}
 */
export function usuarioActual() {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Inicia sesión con correo y contraseña
 * @param {string} correo
 * @param {string} clave
 * @returns {Promise<Object>} Datos del usuario
 */
export async function iniciar(correo, clave) {
  const respuesta = await api.llamar("POST", "/api/auth/login", { correo, clave });
  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem("token", respuesta.token);
    sessionStorage.setItem("usuario", JSON.stringify(respuesta.usuario));
    return respuesta.usuario;
  }
  throw new Error("Respuesta de autenticación inválida");
}

/**
 * Registra un nuevo usuario e inicia sesión automáticamente
 * @param {Object} datos { nombre, apellido, correo, clave, consentimiento }
 * @returns {Promise<Object>} Datos del usuario logueado
 */
export async function registrar(datos) {
  await api.llamar("POST", "/api/auth/registro", datos);
  return await iniciar(datos.correo, datos.clave);
}

/**
 * Cierra la sesión activa en el servidor y localmente
 */
export async function cerrar() {
  try {
    await api.llamar("POST", "/api/auth/logout");
  } catch {
    // Si la llamada falla (p. ej. token vencido), se limpia localmente
  } finally {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");
    window.location.href = "/paginas/ingreso.html";
  }
}

/**
 * Valida los permisos de acceso para la página actual
 * @param {string|string[]} roles - Rol o lista de roles permitidos ("publico", "sesion", "estudiante", etc.)
 * @returns {boolean} true si tiene permiso, false y redirige si no
 */
export function exigirRol(roles) {
  if (!roles) return true;
  const lista = Array.isArray(roles) ? roles : [roles];

  if (lista.includes("publico")) {
    return true;
  }

  const tok = token();
  const usuario = usuarioActual();

  // Sin sesión → redirigir a ingreso.html
  if (!tok || !usuario) {
    if (typeof window !== "undefined" && window.location) {
      window.location.href = "/paginas/ingreso.html";
    }
    return false;
  }

  // Con sesión pero verificación de rol específico
  if (lista.includes("sesion") || lista.includes(usuario.rol)) {
    return true;
  }

  // Rol no permitido → redirigir a /index.html con aviso
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(
      "aviso_pendiente",
      JSON.stringify({
        texto: "No tienes permiso para acceder a esta sección con tu rol actual.",
        tipo: "advertencia"
      })
    );
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.href = "/index.html";
  }
  return false;
}
