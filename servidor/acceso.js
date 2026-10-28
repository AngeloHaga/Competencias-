// servidor/acceso.js · Control de acceso académico por grupo, asignatura y usuario
import * as almacen from "./almacen.js";

async function normalizarUsuario(usuario) {
  if (!usuario) return null;
  if (typeof usuario === "string") {
    const usuarios = await almacen.leer("usuarios");
    return usuarios.find((u) => u.id === usuario) || null;
  }
  return usuario;
}

/**
 * Obtiene los grupos del distributivo correspondientes al usuario
 * @param {Object|string} usuario
 * @returns {Promise<Array>}
 */
export async function gruposDe(usuario) {
  const user = await normalizarUsuario(usuario);
  if (!user) return [];

  const distributivo = await almacen.leer("distributivo");

  // Administrador ve todos los grupos
  if (user.rol === "admin") {
    return distributivo;
  }

  // Docente ve los grupos donde está asignado como docente
  if (user.rol === "docente") {
    return distributivo.filter((g) => g.docenteId === user.id);
  }

  // Estudiante ve los grupos donde figura en la lista de estudiantes
  if (user.rol === "estudiante") {
    return distributivo.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(user.id)
    );
  }

  return [];
}

/**
 * Obtiene las asignaturas a las que pertenece el usuario
 * @param {Object|string} usuario
 * @returns {Promise<Array>}
 */
export async function asignaturasDe(usuario) {
  const user = await normalizarUsuario(usuario);
  if (!user) return [];

  const todas = await almacen.leer("asignaturas");

  if (user.rol === "admin") {
    return todas;
  }

  const grupos = await gruposDe(user);
  const idsAsignaturas = new Set(grupos.map((g) => g.asignaturaId).filter(Boolean));

  return todas.filter((a) => idsAsignaturas.has(a.id));
}

/**
 * Resuelve la asignatura de un tema navegando tema -> unidad -> asignatura
 * @param {string} temaId
 * @returns {Promise<Object|null>}
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer("temas");
  const tema = temas.find((t) => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer("unidades");
  const unidad = unidades.find((u) => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await almacen.leer("asignaturas");
  const asignatura = asignaturas.find((a) => a.id === unidad.asignaturaId);

  return asignatura || null;
}

/**
 * Verifica si un usuario puede editar contenidos de una asignatura
 * @param {Object|string} usuario
 * @param {string|Object} asignaturaId
 * @returns {Promise<boolean>}
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  const user = await normalizarUsuario(usuario);
  if (!user || !asignaturaId) return false;

  const id = typeof asignaturaId === "object" ? asignaturaId.id : asignaturaId;

  if (user.rol === "admin") return true;

  if (user.rol === "docente") {
    const grupos = await gruposDe(user);
    return grupos.some((g) => g.asignaturaId === id);
  }

  return false;
}

/**
 * Obtiene los estudiantes asignados a un docente
 * @param {string} docenteId
 * @returns {Promise<Array>}
 */
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer("distributivo");
  const grupos = distributivo.filter((g) => g.docenteId === docenteId);
  const idsEstudiantes = new Set(grupos.flatMap((g) => g.estudiantes || []));

  const usuarios = await almacen.leer("usuarios");
  return usuarios.filter((u) => idsEstudiantes.has(u.id));
}

/**
 * Obtiene los docentes asignados a un estudiante
 * @param {string} estudianteId
 * @returns {Promise<Array>}
 */
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer("distributivo");
  const grupos = distributivo.filter(
    (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
  );
  const idsDocentes = new Set(grupos.map((g) => g.docenteId).filter(Boolean));

  const usuarios = await almacen.leer("usuarios");
  return usuarios.filter((u) => idsDocentes.has(u.id));
}
