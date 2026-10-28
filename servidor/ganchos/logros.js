// servidor/ganchos/logros.js · Reglas de negocio para la colección logros
import * as acceso from "../acceso.js";

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === "admin") return lista;

  if (usuario.rol === "docente") {
    const misEstudiantes = await acceso.estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes.map((e) => e.id));
    return lista.filter((l) => idsEstudiantes.has(l.usuarioId));
  }

  if (usuario.rol === "estudiante") {
    return lista.filter((l) => l.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
