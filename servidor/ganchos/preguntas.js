// servidor/ganchos/preguntas.js · Reglas de negocio y control de acceso para el banco de preguntas
import * as acceso from "../acceso.js";

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === "admin") return lista;

  if (usuario.rol === "docente") {
    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));

    const permitidas = [];
    for (const p of lista) {
      if (!p.temaId) continue;
      const asig = await acceso.asignaturaDeTema(p.temaId);
      if (asig && idsAsignaturas.has(asig.id)) {
        permitidas.push(p);
      }
    }
    return permitidas;
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const err = new Error("Se requiere iniciar sesión");
    err.estado = 401;
    throw err;
  }

  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const err = new Error("El temaId es obligatorio");
    err.estado = 400;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error("El tema no pertenece a una asignatura válida");
    err.estado = 400;
    throw err;
  }

  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!puedeEditar) {
    const err = new Error("No tienes permiso para editar preguntas en esta asignatura");
    err.estado = 403;
    throw err;
  }

  // Validaciones del formato de la pregunta
  const nivel = Number(datos.nivel);
  if (isNaN(nivel) || nivel < 1 || nivel > 5) {
    const err = new Error("El nivel debe ser un número entero entre 1 y 5");
    err.estado = 400;
    throw err;
  }
  datos.nivel = nivel;

  const tiposValidos = ["opcion", "vf", "completar"];
  if (!datos.tipo || !tiposValidos.includes(datos.tipo)) {
    const err = new Error("El tipo debe ser 'opcion', 'vf' o 'completar'");
    err.estado = 400;
    throw err;
  }

  if (!datos.enunciado || !String(datos.enunciado).trim()) {
    const err = new Error("El enunciado de la pregunta es obligatorio");
    err.estado = 400;
    throw err;
  }

  if (datos.tipo === "opcion") {
    if (!Array.isArray(datos.opciones) || datos.opciones.length !== 4) {
      const err = new Error("Las preguntas de tipo 'opcion' deben incluir exactamente 4 opciones");
      err.estado = 400;
      throw err;
    }
    const correctaNum = Number(datos.correcta);
    if (isNaN(correctaNum) || correctaNum < 0 || correctaNum > 3) {
      const err = new Error("Para 'opcion', 'correcta' debe ser un índice entre 0 y 3");
      err.estado = 400;
      throw err;
    }
    datos.correcta = correctaNum;
  } else if (datos.tipo === "vf") {
    datos.opciones = ["Verdadero", "Falso"];
    if (datos.correcta !== true && datos.correcta !== false && datos.correcta !== "true" && datos.correcta !== "false") {
      const err = new Error("Para 'vf', 'correcta' debe ser true o false");
      err.estado = 400;
      throw err;
    }
    datos.correcta = datos.correcta === true || datos.correcta === "true";
  } else if (datos.tipo === "completar") {
    if (!datos.correcta || !String(datos.correcta).trim()) {
      const err = new Error("Para 'completar', 'correcta' debe ser la palabra o frase de respuesta");
      err.estado = 400;
      throw err;
    }
    datos.correcta = String(datos.correcta).trim();
  }

  datos.origen = datos.origen === "ia" ? "ia" : (datos.origen || "docente");
  datos.estado = datos.estado === "borrador" ? "borrador" : "aprobado";
  datos.retroalimentacion = datos.retroalimentacion ? String(datos.retroalimentacion).trim() : "";

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
