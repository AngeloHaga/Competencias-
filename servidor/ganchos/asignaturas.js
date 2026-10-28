// servidor/ganchos/asignaturas.js · Reglas de seguridad para la colección asignaturas
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const ids = new Set(misAsignaturas.map((a) => a.id));
    return lista.filter((a) => ids.has(a.id));
  }
};
