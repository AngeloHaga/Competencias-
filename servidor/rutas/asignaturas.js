// servidor/rutas/asignaturas.js · Rutas específicas y control de eliminación para asignaturas
import { Router } from "express";
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

const router = Router();

// DELETE /api/asignaturas/:id · Eliminación segura de asignatura para docentes y administradores
router.delete("/asignaturas/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuario = req.usuario;

    if (!usuario || (usuario.rol !== "admin" && usuario.rol !== "docente")) {
      return res.status(403).json({ error: "No tienes permiso para eliminar asignaturas" });
    }

    const asignaturas = await almacen.leer("asignaturas");
    const asignatura = asignaturas.find((a) => a.id === id);
    if (!asignatura) {
      return res.status(404).json({ error: "Asignatura no encontrada" });
    }

    // Si es docente, comprobar que sea docente de esta asignatura
    if (usuario.rol === "docente") {
      const tieneAcceso = await acceso.puedeEditarAsignatura(usuario, id);
      if (!tieneAcceso) {
        return res.status(403).json({ error: "Solo puedes eliminar asignaturas que tengas a tu cargo" });
      }
    }

    // Verificar si tiene estudiantes inscritos
    const distributivo = await almacen.leer("distributivo");
    const gruposAsig = distributivo.filter((g) => g.asignaturaId === id);
    const tieneEstudiantes = gruposAsig.some(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.length > 0
    );

    if (tieneEstudiantes) {
      return res.status(400).json({
        error: "No se puede eliminar la asignatura porque contiene estudiantes inscritos en el distributivo."
      });
    }

    // Eliminar los grupos asociados sin estudiantes en distributivo
    const restanteDistributivo = distributivo.filter((g) => g.asignaturaId !== id);
    if (restanteDistributivo.length !== distributivo.length) {
      await almacen.escribir("distributivo", restanteDistributivo);
    }

    // Eliminar la asignatura
    await almacen.eliminar("asignaturas", id);

    res.json({ ok: true, mensaje: "Asignatura eliminada con éxito" });
  } catch (err) {
    next(err);
  }
});

export default router;
