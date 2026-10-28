// servidor/server.js · Servidor base Express con API genérica y montaje de rutas
import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as almacen from "./almacen.js";
import { cargarUsuario } from "./auth.js";
import { aplicar } from "./ganchos.js";
import { puede } from "./permisos.js";

const app = express();

// Middlewares base
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(import.meta.dirname, "../publico")));

// Middleware de autenticación y carga de usuario
app.use(cargarUsuario);

// Montaje dinámico de rutas personalizadas en /api (orden alfabético)
const dirRutas = path.resolve(import.meta.dirname, "rutas");
try {
  const entradas = await fs.readdir(dirRutas);
  const archivos = entradas.filter((f) => f.endsWith(".js")).sort();
  for (const archivo of archivos) {
    const rutaArchivo = path.join(dirRutas, archivo);
    const mod = await import(pathToFileURL(rutaArchivo).href);
    const router = mod.default || mod;
    app.use("/api", router);
  }
} catch (err) {
  console.error("Error al cargar rutas personalizadas:", err);
}

// API genérica: Listar y filtrar colección
app.get("/api/:col", async (req, res, next) => {
  try {
    const { col } = req.params;
    if (!puede(req.usuario, "leer", col)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    let lista = await almacen.buscar(col, req.query);
    lista = await aplicar(col, "filtrarLista", lista, req.usuario);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// API genérica: Obtener un registro por id
app.get("/api/:col/:id", async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const reg = lista.find((item) => item.id === id);
    if (!reg) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    if (!puede(req.usuario, "leer", col, reg)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    res.json(reg);
  } catch (err) {
    next(err);
  }
});

// API genérica: Crear registro
app.post("/api/:col", async (req, res, next) => {
  try {
    const { col } = req.params;
    if (!puede(req.usuario, "escribir", col, req.body)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    const datos = await aplicar(col, "antesDeGuardar", req.body, req.usuario, null);
    const nuevo = await almacen.agregar(col, datos);
    await aplicar(col, "despuesDeGuardar", nuevo, req.usuario, null);
    res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
});

// API genérica: Actualizar registro (fusiona campos)
app.put("/api/:col/:id", async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);
    if (!anterior) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    if (!puede(req.usuario, "escribir", col, anterior)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    const cambios = await aplicar(col, "antesDeGuardar", req.body, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await aplicar(col, "despuesDeGuardar", actualizado, req.usuario, anterior);
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

// API genérica: Eliminar registro
app.delete("/api/:col/:id", async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);
    if (!anterior) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    if (!puede(req.usuario, "escribir", col, anterior)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    await almacen.eliminar(col, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  const estado = typeof err.estado === "number" ? err.estado : 500;
  res.status(estado).json({ error: err.message || "Error interno del servidor" });
});

// Inicio del servidor
const PUERTO = Number(process.env.PORT) || Number(process.env.PUERTO) || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export default app;
