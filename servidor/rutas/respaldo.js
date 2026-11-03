// servidor/rutas/respaldo.js · Exportación e importación segura de contenidos curriculares para administradores
import { Router } from "express";
import * as almacen from "../almacen.js";

const router = Router();

const COLECCIONES_CONTENIDO = [
  "asignaturas",
  "unidades",
  "temas",
  "glosario",
  "preguntas",
  "canciones",
  "distributivo"
];

// GET /api/respaldo/exportar · Descargar todo el contenido curricular actual en un solo JSON
router.get("/respaldo/exportar", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden exportar el contenido" });
    }

    const exportacion = {
      version: "1.0",
      fecha: new Date().toISOString(),
      datos: {}
    };

    for (const col of COLECCIONES_CONTENIDO) {
      exportacion.datos[col] = await almacen.leer(col);
    }

    res.setHeader("Content-Disposition", `attachment; filename="respaldo-contenidos-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportacion);
  } catch (err) {
    next(err);
  }
});

// POST /api/respaldo/importar · Restaurar contenido curricular desde un JSON
router.post("/respaldo/importar", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden restaurar el contenido" });
    }

    const { datos } = req.body || {};
    if (!datos || typeof datos !== "object") {
      return res.status(400).json({ error: "El archivo de respaldo no contiene datos válidos" });
    }

    let coleccionesRestauradas = 0;
    for (const col of COLECCIONES_CONTENIDO) {
      if (Array.isArray(datos[col])) {
        await almacen.escribir(col, datos[col]);
        coleccionesRestauradas++;
      }
    }

    res.json({
      ok: true,
      mensaje: `Se restauraron con éxito ${coleccionesRestauradas} colecciones de contenidos.`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
