// servidor/preparadores/generar-parejas.js · Preparador de variables para generar parejas de conceptos y definiciones con IA
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

/**
 * Prepara los datos del tema para generar parejas de conceptos y definiciones para el juego de memoria
 * @param {Object} cuerpo { temaId, cantidad }
 * @param {Object} usuario
 * @returns {Promise<Object>} Variables para la plantilla
 */
export default async function prepararGeneracionParejas(cuerpo, usuario) {
  if (!usuario) {
    const err = new Error("Se requiere iniciar sesión");
    err.estado = 401;
    throw err;
  }

  const temaId = cuerpo?.temaId;
  if (!temaId) {
    const err = new Error("El temaId es obligatorio");
    err.estado = 400;
    throw err;
  }

  const cantidad = Number(cuerpo?.cantidad) || 8;

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error("El tema no pertenece a una asignatura válida");
    err.estado = 400;
    throw err;
  }

  const temas = await almacen.leer("temas");
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    const err = new Error("Tema no encontrado");
    err.estado = 404;
    throw err;
  }

  const glosarios = await almacen.leer("glosario");
  const terminosTema = glosarios.filter((g) => g.temaId === temaId);
  const existentes = terminosTema.map((g) => String(g.termino || "").trim().toUpperCase()).join(", ") || "Ninguno";

  let contenido = (tema.resumen || "").trim();
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    contenido += "\nObjetivos de aprendizaje: " + tema.objetivos.join(", ");
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    contenido += "\nEjemplos: " + tema.ejemplos.join("; ");
  }
  if (Array.isArray(tema.palabrasClave) && tema.palabrasClave.length > 0) {
    contenido += "\nPalabras clave: " + tema.palabrasClave.join(", ");
  }
  if (!contenido) {
    contenido = `Conceptos esenciales de ${tema.titulo}.`;
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || "Educación Superior",
    tema: tema.titulo,
    contenido,
    existentes,
    cantidad
  };
}
