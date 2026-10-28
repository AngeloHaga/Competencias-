// servidor/gamificacion.js · Motor de gamificación y procesamiento de intentos
import * as almacen from "./almacen.js";
import * as acceso from "./acceso.js";

// Límite de intentos por hora en memoria (usuarioId -> Array de timestamps)
const intentosEnMemoria = new Map();

function limpiarIntentosAntiguos(usuarioId, ahora) {
  const limiteUnaHora = ahora - 3600 * 1000;
  const lista = (intentosEnMemoria.get(usuarioId) || []).filter((t) => t > limiteUnaHora);
  if (lista.length === 0) {
    intentosEnMemoria.delete(usuarioId);
    return [];
  }
  intentosEnMemoria.set(usuarioId, lista);
  return lista;
}

function obtenerValor(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = ruta.split(".");
  let actual = obj;
  for (const p of partes) {
    if (actual == null) return undefined;
    actual = actual[p];
  }
  return actual;
}

/**
 * Procesa un intento de actividad, calcula puntos, evalúa insignias y actualiza logros
 * @param {Object} usuario
 * @param {Object} datos
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const err = new Error("Usuario no autenticado");
    err.estado = 401;
    throw err;
  }

  const reglas = await almacen.leerConfig("reglas-gamificacion");

  // 1. Validar actividad existente en reglas.puntos
  const actividad = datos?.actividad;
  if (!actividad || !reglas.puntos || typeof reglas.puntos[actividad] !== "number") {
    const err = new Error("Actividad inválida o no registrada en las reglas de puntos");
    err.estado = 400;
    throw err;
  }

  // 2. Validar 0 <= puntaje <= maximo y maximo > 0
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);
  if (isNaN(puntaje) || isNaN(maximo) || maximo <= 0 || puntaje < 0 || puntaje > maximo) {
    const err = new Error("Puntaje o valor máximo inválido (0 <= puntaje <= maximo y maximo > 0)");
    err.estado = 400;
    throw err;
  }

  // 3. Validar acceso al tema si viene temaId
  if (datos.temaId) {
    if (usuario.rol !== "admin") {
      const asignatura = await acceso.asignaturaDeTema(datos.temaId);
      if (!asignatura) {
        const err = new Error("El tema no pertenece a una asignatura válida");
        err.estado = 400;
        throw err;
      }
      const asignaturasPermitidas = await acceso.asignaturasDe(usuario);
      if (!asignaturasPermitidas.some((a) => a.id === asignatura.id)) {
        const err = new Error("No tienes acceso a los contenidos de este tema");
        err.estado = 403;
        throw err;
      }
    }
  }

  // 4. Validar límite de intentos por hora (en memoria)
  const ahora = Date.now();
  const intentosRecientes = limpiarIntentosAntiguos(usuario.id, ahora);
  const maxHora = reglas.limiteIntentosHora || 60;
  if (intentosRecientes.length >= maxHora) {
    const err = new Error("Has alcanzado el límite de intentos por hora. Intenta más tarde.");
    err.estado = 429;
    throw err;
  }
  intentosRecientes.push(ahora);
  intentosEnMemoria.set(usuario.id, intentosRecientes);

  // 5. Cálculo base de puntos: redondeo(reglas.puntos[actividad] * puntaje / maximo) + bonoSinErrores
  const basePuntos = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const errores = datos.errores != null ? Number(datos.errores) : 0;
  const sinErrores = errores === 0 && puntaje === maximo;
  const bono = sinErrores ? Number(reglas.bonoSinErrores || 0) : 0;
  let puntosCalculados = basePuntos + bono;

  // 6. Verificar condiciones para guardar sin puntos
  const todosIntentos = await almacen.leer("intentos");
  const misIntentos = todosIntentos.filter((i) => i.usuarioId === usuario.id);

  // A) Actividad en reglas.unicas y ya hay un intento con puntos con la misma clave
  let esUnicaRepetida = false;
  if (reglas.unicas && reglas.unicas[actividad]) {
    const campos = Array.isArray(reglas.unicas[actividad])
      ? reglas.unicas[actividad]
      : [reglas.unicas[actividad]];
    const claveActual = campos.map((c) => String(obtenerValor(datos, c) ?? "")).join("::");

    esUnicaRepetida = misIntentos.some((prev) => {
      if (prev.actividad !== actividad || (Number(prev.puntos) || 0) <= 0) return false;
      const clavePrev = campos.map((c) => String(obtenerValor(prev, c) ?? "")).join("::");
      return clavePrev === claveActual;
    });
  }

  // B) Actividad en requiereAprobado y detalle.aprobado !== true
  let requiereAprobadoFaltante = false;
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (!datos.detalle || datos.detalle.aprobado !== true) {
      requiereAprobadoFaltante = true;
    }
  }

  // C) Alcanzó hoy reglas.maxDiario[actividad] intentos con puntos
  let maxDiarioAlcanzado = false;
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === "number") {
    const maxPermitidoHoy = reglas.maxDiario[actividad];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = misIntentos.filter((prev) => {
      if (prev.actividad !== actividad || (Number(prev.puntos) || 0) <= 0) return false;
      const fechaPrev = prev.fecha ? String(prev.fecha).slice(0, 10) : "";
      return fechaPrev === hoyStr;
    }).length;

    if (intentosHoyConPuntos >= maxPermitidoHoy) {
      maxDiarioAlcanzado = true;
    }
  }

  if (esUnicaRepetida || requiereAprobadoFaltante || maxDiarioAlcanzado) {
    puntosCalculados = 0;
  }
  const puntosGanados = puntosCalculados;

  // 7. Guardar intento
  const registroIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: datos.nivel != null ? Number(datos.nivel) : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: datos.duracionSeg != null ? Number(datos.duracionSeg) : 0,
    detalle: datos.detalle || {},
    puntos: puntosGanados
  };
  const intentoGuardado = await almacen.agregar("intentos", registroIntento);
  misIntentos.push(intentoGuardado);

  // 8. Actualizar o crear logros
  const todosLogros = await almacen.leer("logros");
  let logro = todosLogros.find((l) => l.usuarioId === usuario.id);
  let esNuevoLogro = false;

  if (!logro) {
    esNuevoLogro = true;
    logro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  logro.puntos = (Number(logro.puntos) || 0) + puntosGanados;
  logro.insignias = logro.insignias || [];
  logro.nivelQuiz = logro.nivelQuiz || {};

  if (actividad === "quiz" && datos.temaId && datos.nivel != null && puntosGanados > 0) {
    const nivelActual = Number(logro.nivelQuiz[datos.temaId]) || 0;
    const nuevoNivel = Number(datos.nivel);
    if (nuevoNivel > nivelActual) {
      logro.nivelQuiz[datos.temaId] = nuevoNivel;
    }
  }

  // 9. Evaluar insignias no obtenidas
  const idsInsigniasObtenidas = new Set(logro.insignias.map((i) => i.id));
  const todasInsignias = await almacen.leer("insignias");
  const insigniasNuevas = [];

  for (const ins of todasInsignias) {
    if (idsInsigniasObtenidas.has(ins.id)) continue;
    const cond = ins.condicion;
    if (!cond || !cond.tipo) continue;

    let cumple = false;

    if (cond.tipo === "conteo") {
      // conteo { actividad, minimo } (cuenta intentos; en actividades únicas, claves distintas)
      const actividadCond = cond.actividad;
      const minimo = Number(cond.minimo) || 1;
      const intentosAct = misIntentos.filter((i) => i.actividad === actividadCond);

      if (reglas.unicas && reglas.unicas[actividadCond]) {
        const campos = Array.isArray(reglas.unicas[actividadCond])
          ? reglas.unicas[actividadCond]
          : [reglas.unicas[actividadCond]];
        const clavesDistintas = new Set(
          intentosAct.map((i) => campos.map((c) => String(obtenerValor(i, c) ?? "")).join("::"))
        );
        cumple = clavesDistintas.size >= minimo;
      } else {
        cumple = intentosAct.length >= minimo;
      }
    } else if (cond.tipo === "sinErrores") {
      // sinErrores { actividad }
      const actividadCond = cond.actividad;
      cumple = misIntentos.some(
        (i) =>
          i.actividad === actividadCond &&
          Number(i.errores) === 0 &&
          Number(i.puntaje) === Number(i.maximo) &&
          Number(i.maximo) > 0
      );
    } else if (cond.tipo === "puntos") {
      // puntos { minimo }
      const minimo = Number(cond.minimo) || 0;
      cumple = logro.puntos >= minimo;
    } else if (cond.tipo === "nivelQuiz") {
      // nivelQuiz { nivel } (en cualquier tema)
      const nivelRequerido = Number(cond.nivel) || 1;
      cumple = Object.values(logro.nivelQuiz || {}).some((lvl) => Number(lvl) >= nivelRequerido);
    } else if (cond.tipo === "racha") {
      // racha { dias } (días consecutivos con intentos hasta hoy)
      const diasRequeridos = Number(cond.dias) || 1;
      const diasConIntentos = new Set(
        misIntentos
          .map((i) => (i.fecha ? String(i.fecha).slice(0, 10) : ""))
          .filter(Boolean)
      );

      let racha = 0;
      const cursor = new Date();
      while (true) {
        const diaStr = cursor.toISOString().slice(0, 10);
        if (diasConIntentos.has(diaStr)) {
          racha++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
          break;
        }
      }
      cumple = racha >= diasRequeridos;
    }

    if (cumple) {
      const nueva = {
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      };
      insigniasNuevas.push(nueva);
      logro.insignias.push({ id: ins.id, fecha: new Date().toISOString() });
      idsInsigniasObtenidas.add(ins.id);
    }
  }

  // Guardar logros actualizados
  if (esNuevoLogro) {
    await almacen.agregar("logros", logro);
  } else {
    await almacen.actualizar("logros", logro.id, logro);
  }

  // 10. Evaluar alertas
  try {
    const alertas = await import("./alertas.js");
    if (typeof alertas.evaluarAlertas === "function") {
      await alertas.evaluarAlertas(intentoGuardado, usuario);
    }
  } catch (err) {
    console.error("Error al evaluar alertas:", err);
  }

  return {
    puntosGanados,
    puntosTotales: logro.puntos,
    insigniasNuevas
  };
}
