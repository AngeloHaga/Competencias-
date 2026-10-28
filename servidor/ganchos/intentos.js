// servidor/ganchos/intentos.js · Reglas de negocio para la colección intentos
import * as acceso from "../acceso.js";

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === "admin") return lista;

  if (usuario.rol === "docente") {
    const misEstudiantes = await acceso.estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes.map((e) => e.id));
    return lista.filter((i) => idsEstudiantes.has(i.usuarioId));
  }

  if (usuario.rol === "estudiante") {
    return lista.filter((i) => i.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
