// servidor/rutas/gamificacion.js · Rutas de gamificación: intentos y logros
import { Router } from "express";
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";
import * as gamificacion from "../gamificacion.js";

const router = Router();

// POST /api/intentos · Registrar y procesar intento de actividad
router.post("/intentos", async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: "Se requiere iniciar sesión para registrar intentos" });
    }

    const resultado = await gamificacion.procesarIntento(req.usuario, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    if (err.estado) {
      return res.status(err.estado).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/logros/:usuarioId · Obtener logros e insignias de un usuario ("yo" permitido)
router.get("/logros/:usuarioId", async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: "Se requiere iniciar sesión para consultar logros" });
    }

    const { usuarioId } = req.params;
    const targetId = usuarioId === "yo" ? req.usuario.id : usuarioId;

    // Verificar permisos: propio estudiante, docente de sus grupos o admin
    let permitido = false;
    if (req.usuario.rol === "admin") {
      permitido = true;
    } else if (req.usuario.id === targetId) {
      permitido = true;
    } else if (req.usuario.rol === "docente") {
      const misEstudiantes = await acceso.estudiantesDe(req.usuario.id);
      if (misEstudiantes.some((e) => e.id === targetId)) {
        permitido = true;
      }
    }

    if (!permitido) {
      return res.status(403).json({ error: "No tienes permiso para consultar los logros de este usuario" });
    }

    const todosLogros = await almacen.leer("logros");
    const logro = todosLogros.find((l) => l.usuarioId === targetId) || {
      usuarioId: targetId,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };

    res.json(logro);
  } catch (err) {
    next(err);
  }
});

export default router;
