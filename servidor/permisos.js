// servidor/permisos.js · Control de permisos según datos/config/permisos.json
import fs from "node:fs";
import path from "node:path";

const RUTA_PERMISOS = path.resolve(import.meta.dirname, "../datos/config/permisos.json");

function obtenerPermisos() {
  try {
    const raw = fs.readFileSync(RUTA_PERMISOS, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Comprueba si un usuario puede ejecutar una acción ('leer' | 'escribir') sobre una colección o registro
export function puede(usuario, accion, col, registro = null) {
  if (accion !== "leer" && accion !== "escribir") return false;

  const permisos = obtenerPermisos();
  const clave = col.includes("/") ? col.split("/")[0] : col;
  const config = permisos[col] || permisos[clave];

  // Colección no listada -> false
  if (!config) return false;

  const permitidos = config[accion];
  if (!Array.isArray(permitidos) || permitidos.length === 0) return false;

  // Acceso público no requiere usuario
  if (permitidos.includes("publico")) return true;

  // Si no hay usuario autenticado y no es público, denegar
  if (!usuario) return false;

  // Cualquier usuario con sesión activa
  if (permitidos.includes("sesion")) return true;

  // Coincidencia por rol (estudiante, docente, admin)
  if (usuario.rol && permitidos.includes(usuario.rol)) return true;

  // Coincidencia por recurso propio
  if (permitidos.includes("propio")) {
    if (!registro) {
      // Al listar o crear sin registro previo se permite pasar al filtro o gancho
      return true;
    }
    if (registro.usuarioId && String(registro.usuarioId) === String(usuario.id)) {
      return true;
    }
    if ((col === "usuarios" || clave === "usuarios") && String(registro.id) === String(usuario.id)) {
      return true;
    }
  }

  // "servidor" nunca se permite desde la API
  return false;
}
