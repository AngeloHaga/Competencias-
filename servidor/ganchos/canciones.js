// servidor/ganchos/canciones.js · Reglas de seguridad para la colección canciones
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    const temas = await almacen.leer("temas");
    const unidades = await almacen.leer("unidades");
    const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));
    const mapaTemas = new Map(temas.map((t) => [t.id, t]));

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));

    return lista.filter((c) => {
      const tema = mapaTemas.get(c.temaId);
      if (!tema) return false;
      const unidad = mapaUnidades.get(tema.unidadId);
      return unidad && idsAsignaturas.has(unidad.asignaturaId);
    });
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const temaId = datos.temaId || anterior?.temaId;
    const asignatura = await acceso.asignaturaDeTema(temaId);
    const puede = await acceso.puedeEditarAsignatura(usuario, asignatura?.id);

    if (!puede) {
      const err = new Error("No tienes permiso para gestionar canciones en esta asignatura");
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};
