// servidor/ia.js · Motor de tareas de Inteligencia Artificial y orquestación de prompts
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as almacen from "./almacen.js";

const DIR_PROMPTS = path.resolve(import.meta.dirname, "prompts");
const DIR_PREPARADORES = path.resolve(import.meta.dirname, "preparadores");

/**
 * Obtiene la configuración actual de la IA desde ajustes.json con respaldo en .env
 * @returns {Promise<{ proveedor: string, modelo: string, clave: string, limiteIADiario: number }>}
 */
export async function obtenerConfiguracionIA() {
  const ajustes = await almacen.leerConfig("ajustes");
  return {
    proveedor: ajustes.iaProveedor || process.env.IA_PROVEEDOR || "gemini",
    modelo: (ajustes.iaModelo || process.env.IA_MODELO || "gemini-3.8-flash").trim(),
    clave: (ajustes.iaClave || process.env.IA_CLAVE || "").trim(),
    limiteIADiario: Number(ajustes.limiteIADiario) || 30
  };
}

export const MODELOS_DISPONIBLES = [
  { id: "gemini-1.5-flash", nombre: "Gemini 1.5 Flash (Recomendado - Rápido y Estable)" },
  { id: "gemini-1.5-pro", nombre: "Gemini 1.5 Pro (Razonamiento Complejo)" },
  { id: "gemini-2.0-flash", nombre: "Gemini 2.0 Flash (Nueva Generación)" },
  { id: "gemini-2.0-flash-lite", nombre: "Gemini 2.0 Flash Lite (Baja Latencia)" },
  { id: "gemini-1.0-pro", nombre: "Gemini 1.0 Pro (Clásico)" },
  { id: "gemini-3.8-flash", nombre: "Gemini 3.8 Flash" },
  { id: "gemini-4-argon", nombre: "Gemini 4 Argon" }
];

/**
 * Realiza la invocación HTTP a Google Gemini manejando Bearer y API Key
 */
export async function invocarGemini(modelo, clave, cuerpo) {
  const intentar = async (esBearer) => {
    const url = esBearer
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`;

    const headers = {
      "Content-Type": "application/json"
    };

    if (esBearer) {
      headers["Authorization"] = `Bearer ${clave}`;
    } else {
      headers["x-goog-api-key"] = clave;
    }

    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(cuerpo)
    });
  };

  // Solo tokens de acceso OAuth directos de GCP inician con ya29.
  // Las Authorization Keys de Google AI Studio (AQ.) y las tradicionales (AIzaSy) son API Keys
  const preferirBearer = clave.startsWith("ya29.");
  let res = await intentar(preferirBearer);

  if (res.status === 401 && preferirBearer) {
    const resAlt = await intentar(false);
    if (resAlt.ok) return resAlt;
  }

  return res;
}

/**
 * Prueba la conexión con el proveedor de IA utilizando la configuración indicada o actual
 * @param {Object} [params] { clave, modelo, proveedor }
 * @returns {Promise<{ ok: boolean, mensaje: string, respuesta?: string, error?: string }>}
 */
export async function probarConexionIA(params = {}) {
  const config = await obtenerConfiguracionIA();
  const clave = (params.clave !== undefined ? params.clave : config.clave).trim();
  const modelo = (params.modelo || config.modelo || "gemini-1.5-flash").trim();
  const proveedor = params.proveedor || config.proveedor || "gemini";

  if (!clave) {
    return {
      ok: false,
      error: "No se ha configurado ninguna clave de API para la IA."
    };
  }

  if (clave.length < 20) {
    return {
      ok: false,
      error: `La clave ingresada parece incompleta (tiene solo ${clave.length} caracteres). Las claves completas de Google Gemini (iniciadas en 'AQ.' o 'AIzaSy...') tienen entre 39 y 45 caracteres. Asegúrate de copiar y pegar la clave completa.`
    };
  }

  try {
    if (proveedor === "gemini") {
      const cuerpo = {
        contents: [
          {
            role: "user",
            parts: [{ text: "Responde únicamente la frase: 'Conexión con Gemini establecida correctamente.'" }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 60
        }
      };

      const res = await invocarGemini(modelo, clave, cuerpo);

      if (!res.ok) {
        const errorText = await res.text();
        let detalle = errorText;
        try {
          const parsed = JSON.parse(errorText);
          detalle = parsed.error?.message || errorText;
        } catch {}

        if (res.status === 401) {
          let sugerencia = "";
          if (clave.startsWith("AQ.") || clave.startsWith("ya29.")) {
            sugerencia = " El token OAuth2 ('AQ.' o 'ya29.') está incompleto o ha expirado (los tokens de acceso de GCP expiran a los 60 min). Para una API Key permanente que no expire, genera una gratis en Google AI Studio (aistudio.google.com/app/apikey).";
          } else if (!clave.startsWith("AIzaSy")) {
            sugerencia = " Las API Keys de Google AI Studio habitualmente inician con 'AIzaSy...'. Puedes obtener una clave en aistudio.google.com/app/apikey.";
          }
          return {
            ok: false,
            error: `Error de Gemini (401): Credencial no válida.${sugerencia} (Detalle de Google: ${detalle})`
          };
        }

        return {
          ok: false,
          error: `Error de Gemini (${res.status}): ${detalle}`
        };
      }

      const data = await res.json();
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      return {
        ok: true,
        mensaje: "Conexión exitosa con Google Gemini",
        respuesta: texto
      };
    }

    return {
      ok: false,
      error: `Proveedor no soportado: ${proveedor}`
    };
  } catch (err) {
    return {
      ok: false,
      error: `Fallo de red o conexión: ${err.message}`
    };
  }
}

/**
 * Ejecuta una tarea de IA procesando preparador, prompt e invocación
 * @param {string} tarea
 * @param {Object} datos
 * @param {Object} usuario
 * @param {Object} [opciones] { formato: "json" | "texto" }
 * @returns {Promise<any>}
 */
export async function ejecutarTarea(tarea, datos, usuario, { formato = "json" } = {}) {
  if (!usuario) {
    const err = new Error("Se requiere iniciar sesión para usar la IA");
    err.estado = 401;
    throw err;
  }

  const config = await obtenerConfiguracionIA();

  // Control de límite diario de consumo de IA
  const hoyStr = new Date().toISOString().slice(0, 10);
  const consumos = await almacen.leerLineas("consumo-ia");
  const consumosHoy = consumos.filter(
    (c) => c.usuarioId === usuario.id && c.fecha && c.fecha.slice(0, 10) === hoyStr
  );

  const ajustes = await almacen.leerConfig("ajustes");
  const limiteTutor = Number(ajustes.limiteTutorDiario) || 40;

  if (tarea === "tutor") {
    const tutorHoy = consumosHoy.filter((c) => c.tarea === "tutor");
    if (tutorHoy.length >= limiteTutor) {
      const err = new Error(`Has alcanzado el límite diario de ${limiteTutor} consultas con el tutor virtual`);
      err.estado = 429;
      throw err;
    }
  } else {
    const genHoy = consumosHoy.filter((c) => c.tarea !== "tutor");
    if (genHoy.length >= config.limiteIADiario) {
      const err = new Error("Has alcanzado el límite diario de consultas a la IA");
      err.estado = 429;
      throw err;
    }
  }

  // 1. Ejecutar preparador si existe
  let variables = datos || {};
  try {
    const rutaPrep = path.join(DIR_PREPARADORES, `${tarea}.js`);
    const modPrep = await import(pathToFileURL(rutaPrep).href);
    const fnPrep = modPrep.default || modPrep;
    if (typeof fnPrep === "function") {
      variables = await fnPrep(datos, usuario);
    }
  } catch (err) {
    if (err.estado) throw err;
  }

  // 2. Cargar plantilla de prompt
  const rutaPrompt = path.join(DIR_PROMPTS, `${tarea}.txt`);
  let plantilla = "";
  try {
    plantilla = await fs.readFile(rutaPrompt, "utf8");
  } catch {
    const err = new Error(`No existe plantilla de prompt para la tarea: ${tarea}`);
    err.estado = 404;
    throw err;
  }

  // 3. Interpolar {{claves}}
  let promptInterpolado = plantilla.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, clave) => {
    return variables[clave] !== undefined ? String(variables[clave]) : "";
  });

  const partes = promptInterpolado.split("### USUARIO");
  const promptSistema = (partes[0] || "").trim();
  const promptUsuario = (partes[1] || promptInterpolado).trim();

  let resultadoFinal = null;

  // 4. Si hay API key configurada, invocar proveedor Gemini
  if (config.clave && config.proveedor === "gemini") {
    try {
      const cuerpoPeticion = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${promptSistema}\n\n${promptUsuario}` }]
          }
        ],
        generationConfig: {
          temperature: tarea === "tutor" ? 0.35 : 0.2,
          responseMimeType: formato === "json" ? "application/json" : "text/plain"
        }
      };

      const res = await invocarGemini(config.modelo, config.clave, cuerpoPeticion);

      if (!res.ok) {
        const errorText = await res.text();
        let detalle = errorText;
        try {
          const parsed = JSON.parse(errorText);
          detalle = parsed.error?.message || errorText;
        } catch {}
        console.warn(`Error al invocar API de Gemini (${res.status}): ${detalle}. Se utilizará generador de respaldo.`);
      } else {
        const jsonRes = await res.json();
        const texto = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (formato === "json") {
          let textoLimpio = texto.trim();
          if (textoLimpio.startsWith("```json")) {
            textoLimpio = textoLimpio.replace(/^```json\s*/, "").replace(/```$/, "").trim();
          } else if (textoLimpio.startsWith("```")) {
            textoLimpio = textoLimpio.replace(/^```\s*/, "").replace(/```$/, "").trim();
          }
          resultadoFinal = JSON.parse(textoLimpio);
        } else {
          resultadoFinal = texto;
        }
      }
    } catch (err) {
      console.warn("Fallo en la comunicación con el proveedor de IA:", err.message);
    }
  }

  // 5. Generador determinista estructurado de respaldo si no hay API key o falló
  if (!resultadoFinal) {
    resultadoFinal = generarRespaldo(tarea, variables);
  }

  // 6. Registrar en consumo-ia.jsonl
  await almacen.anexarLinea("consumo-ia", {
    usuarioId: usuario.id,
    tarea,
    entrada: { tarea, temaId: datos?.temaId, asignaturaId: datos?.asignaturaId, modelo: config.modelo },
    salida: Array.isArray(resultadoFinal) ? `${resultadoFinal.length} elementos` : "ok",
    ok: true,
    fecha: new Date().toISOString()
  }).catch(() => {});

  // 7. Si es tutor, registrar en consultas-tutor
  if (tarea === "tutor") {
    try {
      const consultas = await almacen.leer("consultas-tutor");
      let reg = consultas.find(
        (c) => c.usuarioId === usuario.id && c.dia === hoyStr && (c.asignaturaId === (datos.asignaturaId || null))
      );
      if (!reg) {
        reg = {
          id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          usuarioId: usuario.id,
          asignaturaId: datos.asignaturaId || null,
          temaId: datos.temaId || null,
          dia: hoyStr,
          mensajes: [],
          fecha: new Date().toISOString()
        };
        consultas.push(reg);
      }
      reg.mensajes.push({
        rol: "estudiante",
        texto: String(datos.mensaje || "").trim(),
        fecha: new Date().toISOString()
      });
      reg.mensajes.push({
        rol: "tutor",
        texto: typeof resultadoFinal === "string" ? resultadoFinal : (resultadoFinal?.respuesta || ""),
        fecha: new Date().toISOString()
      });
      await almacen.escribir("consultas-tutor", consultas);
    } catch (err) {
      console.warn("No se pudo registrar en consultas-tutor:", err.message);
    }
  }

  return resultadoFinal;
}

function generarRespaldo(tarea, vars) {
  if (tarea === "generar-preguntas") {
    const cantidad = Number(vars.cantidad) || 5;
    const tema = vars.tema || "Tema Académico";
    const nivelBloom = vars.nivelBloom || "1 · Recordar";
    const lista = [];

    const tipos = ["opcion", "vf", "completar"];
    for (let i = 0; i < cantidad; i++) {
      const tipo = tipos[i % tipos.length];
      if (tipo === "opcion") {
        lista.push({
          tipo: "opcion",
          enunciado: `¿Cuál de las siguientes afirmaciones describe mejor el concepto de ${tema} en el nivel ${nivelBloom}?`,
          opciones: [
            `Principio fundamental de aplicación práctica en ${tema}.`,
            `Enfoque secundario no relacionado con los objetivos centrales.`,
            `Definición alternativa sin validez metodológica.`,
            `Restricción operativa descontinuada.`
          ],
          correcta: 0,
          retroalimentacion: `Es correcta porque sintetiza el principio fundamental analizado en ${tema}.`
        });
      } else if (tipo === "vf") {
        lista.push({
          tipo: "vf",
          enunciado: `En el estudio de ${tema}, ¿los procedimientos establecidos garantizan la validez de los resultados formativos?`,
          opciones: ["Verdadero", "Falso"],
          correcta: true,
          retroalimentacion: `Es verdadero ya que el marco metodológico de ${tema} asegura rigor y coherencia en los resultados.`
        });
      } else {
        lista.push({
          tipo: "completar",
          enunciado: `El componente fundamental que articula las competencias en ${tema} se denomina ____ pedagógica.`,
          opciones: ["mediación"],
          correcta: "mediación",
          retroalimentacion: `La respuesta es 'mediación' porque conecta las estrategias de aprendizaje con el desarrollo de competencias.`
        });
      }
    }
    return lista;
  }

  if (tarea === "generar-glosario") {
    const tema = vars.tema || "Contenido";
    return [
      {
        termino: "METODO",
        definicion: "Procedimiento ordenado para alcanzar un objetivo formativo.",
        pista: "Camino o vía planificada.",
        retroalimentacion: "El método estructura las etapas del aprendizaje."
      },
      {
        termino: "SABERES",
        definicion: "Conjunto articulado de conocimientos y habilidades integradas.",
        pista: "Dominio conceptual amplio.",
        retroalimentacion: "Los saberes fundamentan las competencias pedagógicas."
      }
    ];
  }

  if (tarea === "generar-palabras-sopa") {
    const tema = vars.tema || "Aprendizaje";
    const palabrasSoporte = [
      { termino: "DIGITAL", definicion: "Tecnología informática orientada al procesamiento y comunicación de datos.", retroalimentacion: "Concepto clave para los entornos virtuales." },
      { termino: "MEDIACION", definicion: "Intervención pedagógica para facilitar la asimilación del aprendizaje.", retroalimentacion: "La mediación docente conecta teoría y práctica." },
      { termino: "RECURSO", definicion: "Material o medio didáctico diseñado para enriquecer la enseñanza.", retroalimentacion: "Seleccionar recursos adecuados potencia el logro de objetivos." },
      { termino: "DOCENTE", definicion: "Profesional facilitador de procesos educativos y orientador pedagógico.", retroalimentacion: "El rol docente guía el razonamiento crítico del estudiante." },
      { termino: "CALIDAD", definicion: "Cumplimiento riguroso de estándares formativos en la enseñanza.", retroalimentacion: "La calidad académica asegura competencias sólidas." },
      { termino: "SABERES", definicion: "Conjunto de conocimientos, destrezas y valores en acción.", retroalimentacion: "Los saberes integrados forman competencias transversales." },
      { termino: "VIRTUAL", definicion: "Entorno digital no presencial diseñado para la formación continua.", retroalimentacion: "Los ecosistemas virtuales transforman el aula tradicional." },
      { termino: "LOGROS", definicion: "Metas de aprendizaje alcanzadas mediante esfuerzo y práctica constante.", retroalimentacion: "Cada logro consolida una competencia adquirida." },
      { termino: "DISENO", definicion: "Planificación estructurada de secuencias didácticas de aprendizaje.", retroalimentacion: "El diseño instruccional organiza los contenidos curriculares." },
      { termino: "CRITERIO", definicion: "Pauta evaluativa para contrastar el nivel de dominio de una competencia.", retroalimentacion: "Los criterios de evaluación garantizan objetividad." }
    ];
    const cant = Number(vars.cantidad) || 10;
    return palabrasSoporte.slice(0, cant);
  }

  if (tarea === "tutor") {
    const estudiante = vars.estudiante || "Estudiante";
    const asignatura = vars.asignatura || "la asignatura";
    const msg = (vars.mensaje || "").toLowerCase().trim();
    const contenido = (vars.contenidoCurricular || "").toLowerCase();

    // 1. Saludos
    if (/^(hola|buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches|saludos|qu[eé]\s*tal|hey)/i.test(msg)) {
      return `¡Hola, ${estudiante}! 👋 Soy tu Tutor Virtual Socrático de **${asignatura}**.\n\nEstoy aquí para acompañarte a explorar y dominar cada contenido de nuestra materia mediante pistas y preguntas reflexivas en lugar de respuestas directas.\n\n¿Sobre qué unidad o concepto te gustaría que reflexionemos hoy?`;
    }

    // 2. Control estricto de límite curricular
    const palabras = msg
      .replace(/[¿?¡!.,;:()]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length >= 4);

    const coincide = palabras.some((p) => contenido.includes(p));

    if (!coincide && palabras.length >= 2) {
      return `Como tu tutor socrático exclusivo de **${asignatura}**, mi misión pedagógica está orientada estrictamente a los contenidos y unidades de nuestro programa curricular.\n\nPara avanzar con éxito en tu formación, ¿te gustaría que formulemos una pregunta orientadora sobre alguno de los temas de nuestra asignatura?`;
    }

    // 3. Respuesta pedagógica socrática guiada
    return `¡Es un excelente planteamiento para profundizar, ${estudiante}!\n\nEn lugar de darte una definición cerrada, apliquemos el método socrático para que construyas tu propio razonamiento:\n\n1. **Pregunta orientadora:** Según los contenidos y lecturas de la asignatura, ¿de qué manera este concepto influye en la práctica educativa o en el logro de los objetivos formativos?\n2. **Pista de reflexión:** Piensa en qué elemento fundamental se vería afectado si omitiéramos este principio.\n\n¿Qué hipótesis o idea preliminar tienes al respecto? Cuéntame y la iremos analizando juntos paso a paso. 💡`;
  }

  return { ok: true, mensaje: "Generación simulada" };
}
