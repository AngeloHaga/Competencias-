// servidor/ganchos/progreso-temas.js · Reglas de seguridad para la colección progreso-temas
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    if (usuario.rol === "docente") {
      const misEstudiantes = await acceso.estudiantesDe(usuario.id);
      const idsEstudiantes = new Set(misEstudiantes.map((e) => e.id));
      return lista.filter((pt) => idsEstudiantes.has(pt.usuarioId));
    }

    if (usuario.rol === "estudiante") {
      return lista.filter((pt) => pt.usuarioId === usuario.id);
    }

    return [];
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error("Se requiere iniciar sesión");
      err.estado = 401;
      throw err;
    }

    datos.usuarioId = usuario.id;

    if (!datos.temaId) {
      const err = new Error("El temaId es obligatorio");
      err.estado = 400;
      throw err;
    }

    const existentes = await almacen.leer("progreso-temas");
    const esDuplicado = existentes.some(
      (pt) =>
        pt.usuarioId === usuario.id &&
        pt.temaId === datos.temaId &&
        (!anterior || pt.id !== anterior.id)
    );

    if (esDuplicado) {
      const err = new Error("El progreso para este tema ya se encuentra registrado");
      err.estado = 400;
      throw err;
    }

    return datos;
  }
};
