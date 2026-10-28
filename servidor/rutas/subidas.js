// servidor/rutas/subidas.js · Ruta de subida de archivos (imágenes, documentos y audios)
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import * as almacen from "../almacen.js";
import { exigirRol } from "../auth.js";

const router = Router();

// Asegurar existencia de carpeta de subidas
const dirSubidas = path.resolve(import.meta.dirname, "../../publico/recursos/subidas");
if (!fs.existsSync(dirSubidas)) {
  fs.mkdirSync(dirSubidas, { recursive: true });
}

// Configuración de almacenamiento seguro con multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dirSubidas);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString("hex");
    cb(null, `${aleatorio}${ext}`);
  }
});

// Tipos permitidos para estudiantes
const tiposImagenes = ["image/jpeg", "image/png", "image/webp"];
const extImagenes = [".jpg", ".jpeg", ".png", ".webp"];

// Tipos adicionales para docentes y administradores (PDF y MP3)
const tiposDocenteAdmin = [
  ...tiposImagenes,
  "application/pdf",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mpeg"
];
const extDocenteAdmin = [...extImagenes, ".pdf", ".mp3"];

// POST /api/subidas (con sesión)
router.post("/subidas", exigirRol(), async (req, res, next) => {
  try {
    const esDocenteOAdmin =
      req.usuario && (req.usuario.rol === "docente" || req.usuario.rol === "admin");

    const ajustes = await almacen.leerConfig("ajustes");
    const maxMB = esDocenteOAdmin ? ajustes.maxSubidaMB || 10 : 2;
    const maxBytes = maxMB * 1024 * 1024;

    const tiposAceptados = esDocenteOAdmin ? tiposDocenteAdmin : tiposImagenes;
    const extAceptadas = esDocenteOAdmin ? extDocenteAdmin : extImagenes;

    const upload = multer({
      storage,
      limits: { fileSize: maxBytes },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const mimeValido = tiposAceptados.includes(file.mimetype);
        const extValida = extAceptadas.includes(ext);

        if (mimeValido && extValida) {
          cb(null, true);
        } else {
          const mensaje = esDocenteOAdmin
            ? "Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3"
            : "Solo se permiten imágenes en formato JPG, PNG o WEBP";
          cb(new Error(mensaje));
        }
      }
    });

    upload.single("archivo")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: `El archivo supera el límite de ${maxMB} MB permitidos` });
        }
        return res.status(400).json({ error: err.message || "Error al procesar el archivo" });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ error: "No se proporcionó ningún archivo en el campo 'archivo'" });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.status(201).json({ url });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
