// servidor/ganchos/unidades.js · Reglas de seguridad para la colección unidades
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const ids = new Set(misAsignaturas.map((a) => a.id));

    let filtradas = lista.filter((u) => ids.has(u.asignaturaId));

    if (usuario.rol === "estudiante") {
      filtradas = filtradas.filter((u) => u.visible !== false);
    }

    return filtradas;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;
    const puede = await acceso.puedeEditarAsignatura(usuario, asignaturaId);

    if (!puede) {
      const err = new Error("No tienes permiso para editar unidades en esta asignatura");
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};
