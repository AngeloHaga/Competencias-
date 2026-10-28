// servidor/rutas/quiz.js · Motor del quiz evaluativo por niveles de Bloom
import { Router } from "express";
import * as almacen from "../almacen.js";
import * as acceso from "../acceso.js";
import * as gamificacion from "../gamificacion.js";
import { notificar } from "../notificar.js";

const router = Router();

const NOMBRES_NIVELES = {
  1: "Recordar",
  2: "Comprender",
  3: "Aplicar",
  4: "Analizar",
  5: "Evaluar"
};

function normalizar(texto) {
  if (typeof texto !== "string") return "";
  return texto
    .trim()
    .toUpperCase()
    .replace(/Ñ/g, "\uFFFF")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFF/g, "Ñ");
}

function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function verificarEstudianteConAcceso(req, temaId) {
  if (!req.usuario) {
    const err = new Error("Se requiere iniciar sesión");
    err.estado = 401;
    throw err;
  }

  if (req.usuario.rol !== "estudiante") {
    const err = new Error("Solo los estudiantes pueden acceder al quiz");
    err.estado = 403;
    throw err;
  }

  if (!temaId) {
    const err = new Error("El temaId es obligatorio");
    err.estado = 400;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error("El tema no pertenece a una asignatura válida");
    err.estado = 404;
    throw err;
  }

  const asignaturasEstudiante = await acceso.asignaturasDe(req.usuario);
  if (!asignaturasEstudiante.some((a) => a.id === asignatura.id)) {
    const err = new Error("No tienes acceso a este tema");
    err.estado = 403;
    throw err;
  }

  return asignatura;
}

// GET /api/quiz/estado?temaId=
router.get("/quiz/estado", async (req, res, next) => {
  try {
    const { temaId } = req.query;
    await verificarEstudianteConAcceso(req, temaId);

    const todosLogros = await almacen.leer("logros");
    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    const todosIntentos = await almacen.leer("intentos");
    const misIntentos = todosIntentos.filter(
      (i) => i.usuarioId === req.usuario.id && i.actividad === "quiz" && i.temaId === temaId
    );

    const niveles = [];
    for (let n = 1; n <= 5; n++) {
      let estado = "bloqueado";
      if (n <= nivelAprobado) {
        estado = "aprobado";
      } else if (n === 1 || n === nivelAprobado + 1) {
        estado = "disponible";
      }

      const intentosNivel = misIntentos.filter((i) => Number(i.nivel) === n);
      let mejorPorcentaje = 0;
      if (intentosNivel.length > 0) {
        const porcentajes = intentosNivel.map((i) => {
          const max = Number(i.maximo) || 1;
          const punt = Number(i.puntaje) || 0;
          return Math.round((punt / max) * 100);
        });
        mejorPorcentaje = Math.max(...porcentajes);
      }

      niveles.push({
        nivel: n,
        nombre: NOMBRES_NIVELES[n] || `Nivel ${n}`,
        estado,
        mejorPorcentaje
      });
    }

    res.json({ niveles });
  } catch (err) {
    if (err.estado) return res.status(err.estado).json({ error: err.message });
    next(err);
  }
});

// POST /api/quiz/iniciar { temaId, nivel }
router.post("/quiz/iniciar", async (req, res, next) => {
  try {
    const { temaId, nivel } = req.body || {};
    const nivelNum = Number(nivel);
    if (!nivelNum || nivelNum < 1 || nivelNum > 5) {
      return res.status(400).json({ error: "Nivel inválido (debe ser del 1 al 5)" });
    }

    const asignatura = await verificarEstudianteConAcceso(req, temaId);

    // Verificar disponibilidad del nivel
    const todosLogros = await almacen.leer("logros");
    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    if (nivelNum > 1 && nivelNum - 1 > nivelAprobado) {
      return res.status(400).json({
        error: `El nivel ${nivelNum} está bloqueado. Debes aprobar el nivel ${nivelNum - 1} primero.`
      });
    }

    const reglas = await almacen.leerConfig("reglas-gamificacion");
    const preguntasPorNivel = Number(reglas.quiz?.preguntasPorNivel) || 10;

    // Preguntas aprobadas del tema y nivel
    const todasPreguntas = await almacen.leer("preguntas");
    const aprobadas = todasPreguntas.filter(
      (p) => p.temaId === temaId && Number(p.nivel) === nivelNum && p.estado === "aprobado"
    );

    if (aprobadas.length === 0) {
      return res.status(400).json({
        error: "No existen preguntas aprobadas en el banco para este nivel y tema."
      });
    }

    // Historial de preguntas vistas por el estudiante según sus quiz-sesiones
    const todasSesiones = await almacen.leer("quiz-sesiones");
    const misSesiones = todasSesiones.filter(
      (s) => s.usuarioId === req.usuario.id && s.temaId === temaId && Number(s.nivel) === nivelNum
    );

    // Mapear cada pregunta con la fecha de la última sesión donde apareció
    const ultimaVistaMap = new Map();
    for (const ses of misSesiones) {
      const fechaSes = new Date(ses.inicio || ses.fecha || 0).getTime();
      for (const pId of ses.preguntasIds || []) {
        const prev = ultimaVistaMap.get(pId) || 0;
        if (fechaSes > prev) {
          ultimaVistaMap.set(pId, fechaSes);
        }
      }
    }

    const preguntasNoVistas = aprobadas.filter((p) => !ultimaVistaMap.has(p.id));
    let preguntasElegidas = [];

    if (preguntasNoVistas.length >= preguntasPorNivel) {
      preguntasElegidas = barajar(preguntasNoVistas).slice(0, preguntasPorNivel);
    } else {
      preguntasElegidas = barajar(preguntasNoVistas);

      // Completar con las vistas hace más tiempo (orden ascendente por fecha de última vista)
      const vistasOrdenadas = aprobadas
        .filter((p) => ultimaVistaMap.has(p.id))
        .sort((a, b) => (ultimaVistaMap.get(a.id) || 0) - (ultimaVistaMap.get(b.id) || 0));

      const faltantes = preguntasPorNivel - preguntasElegidas.length;
      const completadas = vistasOrdenadas.slice(0, faltantes);
      preguntasElegidas = barajar([...preguntasElegidas, ...completadas]);

      // Notificar al docente del grupo (como máximo una vez al día por tema y nivel)
      try {
        const grupos = await acceso.gruposDe(req.usuario);
        const grupo = grupos.find((g) => g.asignaturaId === asignatura.id);
        const docenteId = grupo?.docenteId;

        if (docenteId) {
          const hoyStr = new Date().toISOString().slice(0, 10);
          const todasNotif = await almacen.leer("notificaciones");
          const yaNotificadoHoy = todasNotif.some(
            (n) =>
              n.usuarioId === docenteId &&
              n.fecha &&
              String(n.fecha).slice(0, 10) === hoyStr &&
              n.enlace &&
              n.enlace.includes(`temaId=${temaId}`) &&
              n.mensaje &&
              n.mensaje.includes(`Nivel ${nivelNum}`)
          );

          if (!yaNotificadoHoy) {
            const temas = await almacen.leer("temas");
            const temaObj = temas.find((t) => t.id === temaId);
            const tituloTema = temaObj?.titulo || "el tema";
            await notificar(docenteId, {
              tipo: "alerta",
              mensaje: `El banco de preguntas para "${tituloTema}" (Nivel ${nivelNum}) necesita más reactivos: un estudiante completó el quiz con preguntas repetidas.`,
              enlace: `/paginas/banco-preguntas.html?temaId=${temaId}`
            });
          }
        }
      } catch (errNotif) {
        console.warn("Fallo al notificar al docente sobre reactivos insuficientes:", errNotif.message);
      }
    }

    const sesion = await almacen.agregar("quiz-sesiones", {
      usuarioId: req.usuario.id,
      temaId,
      nivel: nivelNum,
      preguntasIds: preguntasElegidas.map((p) => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    res.status(201).json({
      sesionId: sesion.id,
      preguntas: preguntasElegidas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.opciones || []
      }))
    });
  } catch (err) {
    if (err.estado) return res.status(err.estado).json({ error: err.message });
    next(err);
  }
});

// POST /api/quiz/responder { sesionId, preguntaId, respuesta }
router.post("/quiz/responder", async (req, res, next) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body || {};
    if (!req.usuario || req.usuario.rol !== "estudiante") {
      return res.status(403).json({ error: "Solo estudiantes pueden responder el quiz" });
    }
    if (!sesionId || !preguntaId || respuesta === undefined) {
      return res.status(400).json({ error: "Datos incompletos para responder" });
    }

    const todasSesiones = await almacen.leer("quiz-sesiones");
    const sesion = todasSesiones.find((s) => s.id === sesionId);
    if (!sesion) {
      return res.status(404).json({ error: "Sesión de quiz no encontrada" });
    }
    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: "No tienes permiso sobre esta sesión de quiz" });
    }
    if (sesion.finalizada) {
      return res.status(400).json({ error: "La sesión ya ha sido finalizada" });
    }
    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      return res.status(400).json({ error: "La pregunta no pertenece a esta sesión de quiz" });
    }

    sesion.respuestas = sesion.respuestas || {};
    if (sesion.respuestas[preguntaId] !== undefined) {
      return res.status(400).json({ error: "Esta pregunta ya fue respondida" });
    }

    const todasPreguntas = await almacen.leer("preguntas");
    const pregunta = todasPreguntas.find((p) => p.id === preguntaId);
    if (!pregunta) {
      return res.status(404).json({ error: "Pregunta no encontrada" });
    }

    let correcto = false;
    let correctaTexto = "";

    if (pregunta.tipo === "opcion") {
      const idxCorrecto = Number(pregunta.correcta);
      correcto = Number(respuesta) === idxCorrecto;
      correctaTexto =
        pregunta.opciones?.[idxCorrecto] !== undefined
          ? String(pregunta.opciones[idxCorrecto])
          : String(pregunta.correcta);
    } else if (pregunta.tipo === "vf") {
      const respBool =
        respuesta === true ||
        String(respuesta).toLowerCase() === "true" ||
        String(respuesta).toLowerCase() === "verdadero";
      const pregBool =
        pregunta.correcta === true ||
        String(pregunta.correcta).toLowerCase() === "true" ||
        String(pregunta.correcta).toLowerCase() === "verdadero";
      correcto = respBool === pregBool;
      correctaTexto = pregBool ? "Verdadero" : "Falso";
    } else if (pregunta.tipo === "completar") {
      correcto = normalizar(String(respuesta)) === normalizar(String(pregunta.correcta));
      correctaTexto = String(pregunta.correcta);
    } else {
      correcto = String(respuesta).trim() === String(pregunta.correcta).trim();
      correctaTexto = String(pregunta.correcta);
    }

    sesion.respuestas[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar("quiz-sesiones", sesion.id, {
      respuestas: sesion.respuestas
    });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || "",
      correcta: correctaTexto
    });
  } catch (err) {
    if (err.estado) return res.status(err.estado).json({ error: err.message });
    next(err);
  }
});

// POST /api/quiz/finalizar { sesionId }
router.post("/quiz/finalizar", async (req, res, next) => {
  try {
    const { sesionId } = req.body || {};
    if (!req.usuario || req.usuario.rol !== "estudiante") {
      return res.status(403).json({ error: "Solo estudiantes pueden finalizar el quiz" });
    }
    if (!sesionId) {
      return res.status(400).json({ error: "sesionId es requerido" });
    }

    const todasSesiones = await almacen.leer("quiz-sesiones");
    const sesion = todasSesiones.find((s) => s.id === sesionId);
    if (!sesion) {
      return res.status(404).json({ error: "Sesión de quiz no encontrada" });
    }
    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: "No tienes permiso sobre esta sesión de quiz" });
    }
    if (sesion.finalizada) {
      return res.status(400).json({ error: "La sesión ya ha sido finalizada" });
    }

    const todasPreguntas = await almacen.leer("preguntas");
    const preguntasSesion = (sesion.preguntasIds || [])
      .map((id) => todasPreguntas.find((p) => p.id === id))
      .filter(Boolean);

    const total = preguntasSesion.length;
    let aciertos = 0;
    let errores = 0;
    const repasar = [];

    const respuestas = sesion.respuestas || {};
    for (const preg of preguntasSesion) {
      const resp = respuestas[preg.id];
      if (resp && resp.correcto) {
        aciertos++;
      } else {
        errores++;
        if (preg.retroalimentacion) {
          repasar.push(preg.retroalimentacion);
        }
      }
    }

    const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
    const reglas = await almacen.leerConfig("reglas-gamificacion");
    const minAprobacion = Number(reglas.quiz?.porcentajeAprobacion) || 70;
    const aprobado = porcentaje >= minAprobacion;

    const inicioTs = new Date(sesion.inicio).getTime();
    const duracionSeg = Math.max(0, Math.round((Date.now() - inicioTs) / 1000));

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const todosLogros = await almacen.leer("logros");
      let logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      if (!logro) {
        logro = await almacen.agregar("logros", {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: {}
        });
      }
      logro.nivelQuiz = logro.nivelQuiz || {};
      const nivelActual = Number(logro.nivelQuiz[sesion.temaId]) || 0;
      const nuevoNivel = Math.max(nivelActual, Number(sesion.nivel));
      logro.nivelQuiz[sesion.temaId] = nuevoNivel;
      await almacen.actualizar("logros", logro.id, {
        nivelQuiz: logro.nivelQuiz
      });
    }

    // En todos los casos llama a procesarIntento
    const resIntento = await gamificacion.procesarIntento(req.usuario, {
      actividad: "quiz",
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    await almacen.actualizar("quiz-sesiones", sesion.id, {
      finalizada: true,
      fechaFin: new Date().toISOString(),
      aciertos,
      total,
      porcentaje,
      aprobado
    });

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resIntento.puntosGanados,
      insigniasNuevas: resIntento.insigniasNuevas
    });
  } catch (err) {
    if (err.estado) return res.status(err.estado).json({ error: err.message });
    next(err);
  }
});

export default router;
