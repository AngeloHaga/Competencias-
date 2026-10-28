// servidor/preparadores/tutor.js · Preparador de contexto curricular y sesión para el tutor virtual socrático
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";

/**
 * Prepara el contexto curricular y el historial para el tutor socrático
 * @param {Object} cuerpo { asignaturaId, temaId, mensaje, historial }
 * @param {Object} usuario
 * @returns {Promise<Object>} Variables para la plantilla
 */
export default async function prepararTutor(cuerpo, usuario) {
  if (!usuario) {
    const err = new Error("Se requiere iniciar sesión para interactuar con el tutor virtual");
    err.estado = 401;
    throw err;
  }

  const mensaje = String(cuerpo?.mensaje || "").trim();
  if (!mensaje) {
    const err = new Error("El mensaje de consulta no puede estar vacío");
    err.estado = 400;
    throw err;
  }

  let asignaturaId = cuerpo?.asignaturaId;
  const temaId = cuerpo?.temaId;

  // Si no se proporcionó asignaturaId pero sí temaId, resolver la asignatura
  if (!asignaturaId && temaId) {
    const asigTema = await acceso.asignaturaDeTema(temaId);
    if (asigTema) asignaturaId = asigTema.id;
  }

  if (!asignaturaId) {
    const err = new Error("No se especificó la asignatura para el tutor virtual");
    err.estado = 400;
    throw err;
  }

  // Verificar que la asignatura existe
  const asignaturas = await almacen.leer("asignaturas");
  const asignatura = asignaturas.find((a) => a.id === asignaturaId);
  if (!asignatura) {
    const err = new Error("Asignatura no encontrada");
    err.estado = 404;
    throw err;
  }

  // Verificar acceso a la asignatura
  if (usuario.rol === "estudiante" || usuario.rol === "docente") {
    const asigsPermitidas = await acceso.asignaturasDe(usuario);
    // Si el distributivo tiene asignaturas para este usuario, validar pertenencia
    if (asigsPermitidas.length > 0 && !asigsPermitidas.some((a) => a.id === asignaturaId)) {
      const err = new Error("No tienes acceso a los contenidos de esta asignatura");
      err.estado = 403;
      throw err;
    }
  }

  // Cargar unidades y temas de la asignatura
  const [todasUnidades, todosTemas, todoGlosario] = await Promise.all([
    almacen.leer("unidades"),
    almacen.leer("temas"),
    almacen.leer("glosario")
  ]);

  const unidades = todasUnidades
    .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const idsUnidades = new Set(unidades.map((u) => u.id));
  const temas = todosTemas
    .filter((t) => idsUnidades.has(t.unidadId) && t.estado === "publicado")
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const idsTemas = new Set(temas.map((t) => t.id));
  const glosario = todoGlosario.filter((g) => idsTemas.has(g.temaId) && g.estado === "aprobado");

  // Estructurar el contexto curricular delimitador
  let contenidoCurricular = `ASIGNATURA: ${asignatura.nombre}\nNIVEL EDUCATIVO: ${asignatura.nivel || "Educación Superior"}\nDESCRIPCIÓN GENERAL: ${asignatura.descripcion || "Sin descripción"}\n\n`;

  if (unidades.length === 0) {
    contenidoCurricular += "No hay unidades didácticas registradas en esta asignatura actualmente.\n";
  } else {
    contenidoCurricular += "ESTRUCTURA CURRICULAR OFICIAL (UNIDADES Y TEMAS):\n";
    for (const unidad of unidades) {
      contenidoCurricular += `\n[UNIDAD ${unidad.orden || 1}]: ${unidad.titulo}\n`;
      const temasUnidad = temas.filter((t) => t.unidadId === unidad.id);
      if (temasUnidad.length === 0) {
        contenidoCurricular += "  (Sin temas publicados aún)\n";
      } else {
        for (const tema of temasUnidad) {
          contenidoCurricular += `  * TEMA: ${tema.titulo}\n`;
          if (tema.resumen) {
            contenidoCurricular += `    - Resumen conceptual: ${tema.resumen}\n`;
          }
          if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
            contenidoCurricular += `    - Objetivos de aprendizaje: ${tema.objetivos.join("; ")}\n`;
          }
          if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
            contenidoCurricular += `    - Ejemplos prácticos: ${tema.ejemplos.join("; ")}\n`;
          }
          if (Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0) {
            contenidoCurricular += `    - Errores conceptuales frecuentes para guiar socráticamente: ${tema.erroresFrecuentes.join("; ")}\n`;
          }
          if (Array.isArray(tema.preguntasGuia) && tema.preguntasGuia.length > 0) {
            contenidoCurricular += `    - Preguntas orientadoras del tema: ${tema.preguntasGuia.join("; ")}\n`;
          }
          if (Array.isArray(tema.palabrasClave) && tema.palabrasClave.length > 0) {
            contenidoCurricular += `    - Palabras clave: ${tema.palabrasClave.join(", ")}\n`;
          }
        }
      }
    }
  }

  if (glosario.length > 0) {
    contenidoCurricular += "\nGLOSARIO ACADÉMICO OFICIAL:\n";
    for (const item of glosario.slice(0, 30)) {
      contenidoCurricular += `- ${item.termino}: ${item.definicion}${item.pista ? ` (Pista: ${item.pista})` : ""}\n`;
    }
  }

  // Formatear historial reciente (hasta 8 turnos previos para contextualización)
  let textoHistorial = "";
  if (Array.isArray(cuerpo?.historial) && cuerpo.historial.length > 0) {
    const ultimos = cuerpo.historial.slice(-8);
    const lineas = ultimos.map((h) => {
      const emisor = h.rol === "usuario" || h.rol === "estudiante" ? `Estudiante (${usuario.nombre || "Estudiante"})` : "Tutor Socrático";
      return `${emisor}: ${h.texto}`;
    });
    textoHistorial = lineas.join("\n");
  } else {
    textoHistorial = "(Inicio de la conversación en esta sesión)";
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || "Educación Superior",
    estudiante: usuario.nombre || "Estudiante",
    contenidoCurricular,
    historial: textoHistorial,
    mensaje
  };
}
