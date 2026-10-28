// servidor/ganchos/temas.js · Reglas de seguridad para la colección temas
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    const unidades = await almacen.leer("unidades");
    const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));

    let filtrados = lista.filter((t) => {
      const unidad = mapaUnidades.get(t.unidadId);
      return unidad && idsAsignaturas.has(unidad.asignaturaId);
    });

    if (usuario.rol === "estudiante") {
      filtrados = filtrados.filter((t) => {
        const unidad = mapaUnidades.get(t.unidadId);
        const unidadVisible = !unidad || unidad.visible !== false;
        const temaPublicado = t.estado === "publicado";
        return unidadVisible && temaPublicado;
      });
    }

    return filtrados;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const unidadId = datos.unidadId || anterior?.unidadId;
    const unidades = await almacen.leer("unidades");
    const unidad = unidades.find((u) => u.id === unidadId);
    const asignaturaId = unidad?.asignaturaId;

    const puede = await acceso.puedeEditarAsignatura(usuario, asignaturaId);

    if (!puede) {
      const err = new Error("No tienes permiso para editar temas en esta asignatura");
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};
