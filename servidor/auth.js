// servidor/auth.js · Middleware de autenticación y control de roles
import * as almacen from "./almacen.js";

// Al cargarse borra las sesiones vencidas
try {
  const sesiones = await almacen.leer("sesiones");
  const ahora = new Date();
  const validas = sesiones.filter((s) => new Date(s.expira) > ahora);
  if (validas.length !== sesiones.length) {
    await almacen.escribir("sesiones", validas);
  }
} catch (err) {
  console.error("Error al limpiar sesiones vencidas en auth.js:", err);
}

// Carga el usuario asociado al Bearer token
export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  req.token = null;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const sesiones = await almacen.leer("sesiones");
    const sesion = sesiones.find((s) => s.token === token);
    if (!sesion) {
      return next();
    }

    // Validar vencimiento
    if (new Date(sesion.expira) <= new Date()) {
      return next();
    }

    const usuarios = await almacen.leer("usuarios");
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId);
    if (!usuario || usuario.activo === false) {
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };
    req.token = token;
  } catch (err) {
    console.error("Error al verificar token en cargarUsuario:", err);
  }

  next();
}

// Exige sesión activa y opcionalmente roles específicos
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sesión no iniciada o inválida" });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permisos para acceder a este recurso" });
    }

    next();
  };
}
