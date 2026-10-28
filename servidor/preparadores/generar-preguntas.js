// servidor/preparadores/generar-preguntas.js · Preparador de variables para la generación de preguntas con IA
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

/**
 * Prepara los datos del tema y contexto para la plantilla de preguntas
 * @param {Object} cuerpo { temaId, nivel, cantidad }
 * @param {Object} usuario
 * @returns {Promise<Object>} Variables para la plantilla
 */
export default async function prepararGeneracionPreguntas(cuerpo, usuario) {
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

  const nivel = Number(cuerpo?.nivel);
  if (isNaN(nivel) || nivel < 1 || nivel > 5) {
    const err = new Error("El nivel debe ser un número entre 1 y 5");
    err.estado = 400;
    throw err;
  }

  let cantidad = Number(cuerpo?.cantidad) || 5;
  if (cantidad < 5) cantidad = 5;
  if (cantidad > 15) cantidad = 15;

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error("El tema no pertenece a una asignatura válida");
    err.estado = 400;
    throw err;
  }

  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!puedeEditar) {
    const err = new Error("No tienes permiso para editar preguntas de este tema");
    err.estado = 403;
    throw err;
  }

  const temas = await almacen.leer("temas");
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    const err = new Error("Tema no encontrado");
    err.estado = 404;
    throw err;
  }

  // Glosario del tema: "término: definición"
  const glosarios = await almacen.leer("glosario");
  const terminosTema = glosarios.filter((g) => g.temaId === temaId && g.estado === "aprobado");
  const glosario = terminosTema.length > 0
    ? terminosTema.map((g) => `${g.termino}: ${g.definicion}`).join("\n")
    : "Sin glosario específico registrado";

  // Mapeo del nivel cognitivo de Bloom
  const nivelesBloom = {
    1: "1 · Recordar",
    2: "2 · Comprender",
    3: "3 · Aplicar",
    4: "4 · Analizar",
    5: "5 · Evaluar"
  };
  const nivelBloom = nivelesBloom[nivel] || `Nivel ${nivel}`;

  // Preguntas ya existentes para no repetirlas
  const preguntas = await almacen.leer("preguntas");
  const existentesLista = preguntas
    .filter((p) => p.temaId === temaId && Number(p.nivel) === nivel)
    .map((p) => `- ${p.enunciado}`);
  const existentes = existentesLista.length > 0
    ? existentesLista.join("\n")
    : "Ninguna";

  // Contenido temático
  let contenido = (tema.resumen || "").trim();
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    contenido += "\nObjetivos de aprendizaje: " + tema.objetivos.join(", ");
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    contenido += "\nEjemplos: " + tema.ejemplos.join("; ");
  }
  if (!contenido) {
    contenido = `Conceptos fundamentales y competencias asociadas a ${tema.titulo}.`;
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || "Educación Superior",
    tema: tema.titulo,
    contenido,
    glosario,
    nivelBloom,
    cantidad,
    existentes
  };
}
