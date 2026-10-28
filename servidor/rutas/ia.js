// servidor/rutas/ia.js · Rutas de Inteligencia Artificial y configuración para administradores
import { Router } from "express";
import * as ia from "../ia.js";
import * as almacen from "../almacen.js";

const router = Router();

// GET /api/ia/config · Obtener configuración de IA (admin)
router.get("/ia/config", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden consultar la configuración de IA" });
    }

    const config = await ia.obtenerConfiguracionIA();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /api/ia/config · Guardar configuración de IA: proveedor, modelo y clave (admin)
router.put("/ia/config", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden modificar la configuración de IA" });
    }

    const { proveedor, modelo, clave, limiteIADiario } = req.body || {};
    const ajustes = await almacen.leerConfig("ajustes");

    if (proveedor !== undefined) ajustes.iaProveedor = String(proveedor).trim();
    if (modelo !== undefined) ajustes.iaModelo = String(modelo).trim();
    if (clave !== undefined) ajustes.iaClave = String(clave).trim();
    if (limiteIADiario !== undefined && !isNaN(Number(limiteIADiario))) {
      ajustes.limiteIADiario = Number(limiteIADiario);
    }

    await almacen.escribirConfig("ajustes", ajustes);

    res.json({
      ok: true,
      mensaje: "Configuración de IA guardada con éxito",
      config: {
        proveedor: ajustes.iaProveedor,
        modelo: ajustes.iaModelo,
        clave: ajustes.iaClave,
        limiteIADiario: ajustes.limiteIADiario
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ia/prueba · Probar conexión con el proveedor de IA y el modelo indicado (admin)
router.post("/ia/prueba", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden realizar pruebas de IA" });
    }

    const resultado = await ia.probarConexionIA(req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/prueba · Estado básico del proveedor (admin)
router.get("/ia/prueba", async (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "Solo administradores pueden realizar pruebas de IA" });
    }

    const config = await ia.obtenerConfiguracionIA();
    res.json({
      proveedor: config.proveedor,
      modelo: config.modelo,
      claveConfigurada: Boolean(config.clave)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/modelos · Lista de modelos siempre disponibles de Gemini
router.get("/ia/modelos", (req, res) => {
  res.json(ia.MODELOS_DISPONIBLES);
});

// POST /api/ia/:tarea · Ejecuta una tarea de generación con IA
router.post("/ia/:tarea", async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: "Se requiere iniciar sesión para usar la IA" });
    }

    const { tarea } = req.params;
    const esTexto = tarea === "tutor" || req.body?.formato === "texto";
    const formato = esTexto ? "texto" : "json";
    const resultado = await ia.ejecutarTarea(tarea, req.body, req.usuario, { formato });

    if (typeof resultado === "string") {
      return res.json({ respuesta: resultado });
    }
    res.json(resultado);
  } catch (err) {
    if (err.estado) {
      return res.status(err.estado).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
