// servidor/rutas/auth.js · Rutas de autenticación, perfil, restablecimiento y bitácora
import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import * as almacen from "../almacen.js";
import { exigirRol } from "../auth.js";

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 fallos en 15 minutos por correo)
const intentosFallidos = new Map();

function limpiarFallosAntiguos(ahora) {
  for (const [correo, timestamps] of intentosFallidos.entries()) {
    const recientes = timestamps.filter((t) => ahora - t < 15 * 60 * 1000);
    if (recientes.length === 0) {
      intentosFallidos.delete(correo);
    } else {
      intentosFallidos.set(correo, recientes);
    }
  }
}

function registrarFallo(correo) {
  const ahora = Date.now();
  limpiarFallosAntiguos(ahora);
  const lista = intentosFallidos.get(correo) || [];
  lista.push(ahora);
  intentosFallidos.set(correo, lista);
}

function estaBloqueado(correo) {
  const ahora = Date.now();
  const lista = (intentosFallidos.get(correo) || []).filter((t) => ahora - t < 15 * 60 * 1000);
  return lista.length >= 5;
}

function limpiarFallos(correo) {
  intentosFallidos.delete(correo);
}

// POST /api/auth/registro
router.post("/auth/registro", async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

    if (!nombre || !String(nombre).trim() || !apellido || !String(apellido).trim()) {
      return res.status(400).json({ error: "Nombre y apellido son obligatorios" });
    }

    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo).trim())) {
      return res.status(400).json({ error: "El correo electrónico no es válido" });
    }

    const correoNorm = String(correo).trim().toLowerCase();
    const usuarios = await almacen.leer("usuarios");
    const existe = usuarios.some((u) => u.correo && u.correo.toLowerCase() === correoNorm);
    if (existe) {
      return res.status(400).json({ error: "El correo electrónico ya se encuentra registrado" });
    }

    if (
      typeof clave !== "string" ||
      clave.length < 8 ||
      !/[a-zA-Z]/.test(clave) ||
      !/\d/.test(clave)
    ) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres y contener letras y números"
      });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: "Debes aceptar el consentimiento informado" });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevo = await almacen.agregar("usuarios", {
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      correo: correoNorm,
      claveHash,
      rol: "estudiante",
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    res.status(201).json({
      id: nuevo.id,
      nombre: nuevo.nombre,
      apellido: nuevo.apellido,
      correo: nuevo.correo,
      rol: nuevo.rol
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res, next) => {
  try {
    const { correo, clave } = req.body || {};
    if (!correo || !clave) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const correoNorm = String(correo).trim().toLowerCase();
    if (estaBloqueado(correoNorm)) {
      return res.status(429).json({
        error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos."
      });
    }

    const usuarios = await almacen.leer("usuarios");
    const usuario = usuarios.find((u) => u.correo && u.correo.toLowerCase() === correoNorm);

    if (!usuario || usuario.activo === false) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const coincide = await bcrypt.compare(String(clave), usuario.claveHash);
    if (!coincide) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    limpiarFallos(correoNorm);

    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar("sesiones", {
      token,
      usuarioId: usuario.id,
      expira
    });

    await almacen.anexarLinea("bitacora.jsonl", {
      usuarioId: usuario.id,
      tipo: "login",
      recurso: "auth",
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post("/auth/logout", exigirRol(), async (req, res, next) => {
  try {
    if (req.token) {
      const sesiones = await almacen.leer("sesiones");
      const sesion = sesiones.find((s) => s.token === req.token);
      if (sesion) {
        await almacen.eliminar("sesiones", sesion.id);
      }
    }

    await almacen.anexarLinea("bitacora.jsonl", {
      usuarioId: req.usuario.id,
      tipo: "logout",
      recurso: "auth",
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/yo
router.get("/auth/yo", exigirRol(), async (req, res, next) => {
  try {
    const usuarios = await almacen.leer("usuarios");
    const usuario = usuarios.find((u) => u.id === req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { claveHash, ...perfil } = usuario;
    res.json(perfil);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/perfil
router.put("/auth/perfil", exigirRol(), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body || {};
    const cambios = {};

    if (nombre !== undefined) {
      if (!String(nombre).trim()) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
      }
      cambios.nombre = String(nombre).trim();
    }

    if (apellido !== undefined) {
      if (!String(apellido).trim()) {
        return res.status(400).json({ error: "El apellido no puede estar vacío" });
      }
      cambios.apellido = String(apellido).trim();
    }

    if (foto !== undefined) {
      cambios.foto = foto;
    }

    const actualizado = await almacen.actualizar("usuarios", req.usuario.id, cambios);
    const { claveHash, ...resto } = actualizado;
    res.json(resto);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/clave
router.post("/auth/clave", exigirRol(), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};
    if (!actual || !nueva) {
      return res.status(400).json({ error: "Debes ingresar la contraseña actual y la nueva" });
    }

    const usuarios = await almacen.leer("usuarios");
    const usuario = usuarios.find((u) => u.id === req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const coincide = await bcrypt.compare(String(actual), usuario.claveHash);
    if (!coincide) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta" });
    }

    if (
      typeof nueva !== "string" ||
      nueva.length < 8 ||
      !/[a-zA-Z]/.test(nueva) ||
      !/\d/.test(nueva)
    ) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres y contener letras y números"
      });
    }

    const nuevaHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar("usuarios", req.usuario.id, { claveHash: nuevaHash });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/usuarios/:id/restablecer (solo rol admin)
router.post("/admin/usuarios/:id/restablecer", exigirRol("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer("usuarios");
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Clave temporal de 10 caracteres alfanuméricos seguros
    const caracteres = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let claveTemporal = "";
    const aleatorios = crypto.randomBytes(10);
    for (let i = 0; i < 10; i++) {
      claveTemporal += caracteres[aleatorios[i] % caracteres.length];
    }

    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar("usuarios", id, { claveHash });

    await almacen.anexarLinea("bitacora.jsonl", {
      usuarioId: req.usuario.id,
      tipo: "restablecer-clave",
      recurso: `usuarios/${id}`,
      fecha: new Date().toISOString()
    });

    res.json({ claveTemporal });
  } catch (err) {
    next(err);
  }
});

// POST /api/eventos
router.post("/eventos", async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body || {};
    if (!tipo || !recurso) {
      return res.status(400).json({ error: "Faltan los campos tipo o recurso" });
    }

    const usuarioId = req.usuario ? req.usuario.id : "anonimo";
    await almacen.anexarLinea("bitacora.jsonl", {
      usuarioId,
      tipo: String(tipo),
      recurso: String(recurso),
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
