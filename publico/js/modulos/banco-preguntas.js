// publico/js/modulos/banco-preguntas.js · Gestión del banco de preguntas por niveles cognitivos de Bloom
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import { usuarioActual } from "../nucleo/sesion.js";

await montarPlantilla({ titulo: "Banco de Preguntas", roles: ["docente", "admin"] });

const selectTema = document.getElementById("select-tema");
const btnGenerarIa = document.getElementById("btn-generar-ia");
const btnNuevaPregunta = document.getElementById("btn-nueva-pregunta");
const contenedorPreguntas = document.getElementById("contenedor-preguntas");
const avisoMinimo = document.getElementById("aviso-minimo-preguntas");
const textoAvisoMinimo = document.getElementById("texto-aviso-minimo");
const pestanasBtns = document.querySelectorAll(".pestana-btn");

// Elementos del Modal de Pregunta Manual
const modalPregunta = document.getElementById("modal-pregunta");
const formPregunta = document.getElementById("form-pregunta");
const modalPreguntaTitulo = document.getElementById("modal-pregunta-titulo");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnCancelarModal = document.getElementById("btn-cancelar-modal");
const inputNivel = document.getElementById("input-nivel");
const inputTipo = document.getElementById("input-tipo");
const inputEstado = document.getElementById("input-estado");
const inputEnunciado = document.getElementById("input-enunciado");
const seccionOpciones = document.getElementById("seccion-opciones");
const seccionVf = document.getElementById("seccion-vf");
const seccionCompletar = document.getElementById("seccion-completar");
const selectVfCorrecta = document.getElementById("select-vf-correcta");
const inputCompletarCorrecta = document.getElementById("input-completar-correcta");
const inputRetroalimentacion = document.getElementById("input-retroalimentacion");

// Elementos del Modal de IA
const modalIa = document.getElementById("modal-ia");
const btnCerrarIa = document.getElementById("btn-cerrar-ia");
const btnCancelarIaForm = document.getElementById("btn-cancelar-ia-form");
const btnIniciarGeneracion = document.getElementById("btn-iniciar-generacion");
const inputIaCantidad = document.getElementById("ia-cantidad");
const iaFormularioParametros = document.getElementById("ia-formulario-parametros");
const iaBloquePropuestas = document.getElementById("ia-bloque-propuestas");
const contenedorPropuestasIa = document.getElementById("contenedor-propuestas-ia");
const btnAprobarTodasIa = document.getElementById("btn-aprobar-todas-ia");
const btnFinalizarIa = document.getElementById("btn-finalizar-ia");

// Elementos de Configuración de IA (Administrador)
const btnConfigurarIa = document.getElementById("btn-configurar-ia");
const modalConfigIa = document.getElementById("modal-config-ia");
const formConfigIa = document.getElementById("form-config-ia");
const btnCerrarConfigIa = document.getElementById("btn-cerrar-config-ia");
const cfgIaProveedor = document.getElementById("cfg-ia-proveedor");
const cfgIaModelo = document.getElementById("cfg-ia-modelo");
const cfgIaClave = document.getElementById("cfg-ia-clave");
const cfgIaLimite = document.getElementById("cfg-ia-limite");
const btnToggleVerClave = document.getElementById("btn-toggle-ver-clave");
const btnProbarIa = document.getElementById("btn-probar-ia");
const cfgIaResultadoPrueba = document.getElementById("cfg-ia-resultado-prueba");

let temas = [];
let todasPreguntas = [];
let temaActivoId = null;
let nivelActivo = 1;
let preguntaEditandoId = null;
let propuestasActuales = [];

const parametros = new URLSearchParams(window.location.search);
const temaIdUrl = parametros.get("temaId");

// Configuración de visualización según tipo
function actualizarVisibilidadTipo(tipo) {
  seccionOpciones.classList.toggle("oculto", tipo !== "opcion");
  seccionVf.classList.toggle("oculto", tipo !== "vf");
  seccionCompletar.classList.toggle("oculto", tipo !== "completar");

  for (let i = 0; i < 4; i++) {
    const inputOpt = document.getElementById(`opcion-texto-${i}`);
    if (inputOpt) {
      if (tipo === "opcion") {
        inputOpt.setAttribute("required", "required");
      } else {
        inputOpt.removeAttribute("required");
      }
    }
  }

  if (tipo === "completar") {
    inputCompletarCorrecta.setAttribute("required", "required");
  } else {
    inputCompletarCorrecta.removeAttribute("required");
  }
}

inputTipo.addEventListener("change", () => {
  actualizarVisibilidadTipo(inputTipo.value);
});

// Pestañas de niveles de Bloom
pestanasBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    pestanasBtns.forEach((b) => b.classList.remove("pestana-btn--activa"));
    btn.classList.add("pestana-btn--activa");
    nivelActivo = Number(btn.dataset.nivel) || 1;
    renderizarPreguntas();
  });
});

function actualizarContadoresYAvisos() {
  const preguntasDelTema = todasPreguntas.filter((p) => p.temaId === temaActivoId);

  for (let n = 1; n <= 5; n++) {
    const aprobadas = preguntasDelTema.filter((p) => Number(p.nivel) === n && p.estado === "aprobado").length;
    const badge = document.getElementById(`contador-nivel-${n}`);
    if (badge) {
      badge.textContent = `${aprobadas} aprobadas`;
    }
  }

  const aprobadasNivelActual = preguntasDelTema.filter(
    (p) => Number(p.nivel) === nivelActivo && p.estado === "aprobado"
  ).length;

  if (aprobadasNivelActual < 20) {
    textoAvisoMinimo.textContent = `Este nivel tiene ${aprobadasNivelActual} preguntas aprobadas (menos de 20 recomendadas). Para garantizar variedad y confiabilidad en los cuestionarios, se sugiere contar con al menos 20.`;
    avisoMinimo.classList.remove("oculto");
  } else {
    avisoMinimo.classList.add("oculto");
  }
}

function renderizarPreguntas() {
  contenedorPreguntas.innerHTML = "";

  if (!temaActivoId) {
    contenedorPreguntas.innerHTML = '<p class="texto-suave">Selecciona un tema para ver las preguntas.</p>';
    return;
  }

  actualizarContadoresYAvisos();

  const filtradas = todasPreguntas.filter(
    (p) => p.temaId === temaActivoId && Number(p.nivel) === nivelActivo
  );

  if (filtradas.length === 0) {
    contenedorPreguntas.innerHTML = `
      <div class="tarjeta texto-centro">
        <p class="texto-suave">No hay preguntas registradas en el Nivel ${nivelActivo} para este tema.</p>
        <button type="button" class="btn btn--secundario btn--pequeno" style="margin-top: var(--espacio-s);" onclick="document.getElementById('btn-nueva-pregunta').click()">
          + Crear primera pregunta
        </button>
      </div>
    `;
    return;
  }

  filtradas.forEach((pregunta) => {
    const card = document.createElement("article");
    card.className = "tarjeta-pregunta";

    const tipoTexto = {
      opcion: "Opción múltiple",
      vf: "Verdadero / Falso",
      completar: "Completar"
    }[pregunta.tipo] || pregunta.tipo;

    const estadoClase = pregunta.estado === "aprobado" ? "insignia--exito" : "insignia--advertencia";
    const origenClase = pregunta.origen === "ia" ? "insignia--acento" : "insignia--secundario";

    let respuestasHtml = "";
    if (pregunta.tipo === "opcion") {
      respuestasHtml = (pregunta.opciones || [])
        .map((op, idx) => {
          const esCorrecta = Number(pregunta.correcta) === idx;
          return `
            <div class="respuesta-item ${esCorrecta ? "respuesta-item--correcta" : ""}">
              <span>${esCorrecta ? "✓" : "○"}</span>
              <span>${ui.escapar(op)}</span>
            </div>
          `;
        })
        .join("");
    } else if (pregunta.tipo === "vf") {
      respuestasHtml = `
        <div class="respuesta-item respuesta-item--correcta">
          <span>✓ Respuesta correcta:</span>
          <span>${pregunta.correcta ? "Verdadero" : "Falso"}</span>
        </div>
      `;
    } else if (pregunta.tipo === "completar") {
      respuestasHtml = `
        <div class="respuesta-item respuesta-item--correcta">
          <span>✓ Respuesta esperada:</span>
          <span>${ui.escapar(pregunta.correcta)}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="tarjeta-pregunta__meta">
        <div class="tarjeta-pregunta__badges">
          <span class="insignia insignia--primario">${ui.escapar(tipoTexto)}</span>
          <span class="insignia ${estadoClase}">${pregunta.estado === "aprobado" ? "Aprobada" : "Borrador"}</span>
          <span class="insignia ${origenClase}">Origen: ${pregunta.origen === "ia" ? "IA" : "Docente"}</span>
        </div>
        <span class="texto-suave" style="font-size: var(--tamano-xs);">ID: ${ui.escapar(pregunta.id)}</span>
      </div>

      <div class="tarjeta-pregunta__enunciado">
        ${ui.escapar(pregunta.enunciado)}
      </div>

      <div class="tarjeta-pregunta__respuestas">
        ${respuestasHtml}
      </div>

      ${
        pregunta.retroalimentacion
          ? `<div class="tarjeta-pregunta__retro"><strong>Retroalimentación:</strong> ${ui.escapar(pregunta.retroalimentacion)}</div>`
          : ""
      }

      <div class="tarjeta-pregunta__acciones">
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar-preg" data-id="${pregunta.id}">Editar</button>
        <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-preg" data-id="${pregunta.id}">Eliminar</button>
      </div>
    `;

    card.querySelector(".btn-editar-preg").addEventListener("click", () => abrirModalEdicion(pregunta));
    card.querySelector(".btn-eliminar-preg").addEventListener("click", () => eliminarPregunta(pregunta.id));

    contenedorPreguntas.appendChild(card);
  });
}

function abrirModalCreacion() {
  if (!temaActivoId) {
    ui.aviso("Primero selecciona un tema para crear preguntas", "advertencia");
    return;
  }
  preguntaEditandoId = null;
  modalPreguntaTitulo.textContent = `Nueva Pregunta (Nivel ${nivelActivo})`;
  formPregunta.reset();
  inputNivel.value = String(nivelActivo);
  inputTipo.value = "opcion";
  inputEstado.value = "aprobado";
  actualizarVisibilidadTipo("opcion");
  modalPregunta.classList.remove("oculto");
  inputEnunciado.focus();
}

function abrirModalEdicion(pregunta) {
  preguntaEditandoId = pregunta.id;
  modalPreguntaTitulo.textContent = "Editar Pregunta";
  inputNivel.value = String(pregunta.nivel || nivelActivo);
  inputTipo.value = pregunta.tipo || "opcion";
  inputEstado.value = pregunta.estado || "aprobado";
  inputEnunciado.value = pregunta.enunciado || "";
  inputRetroalimentacion.value = pregunta.retroalimentacion || "";

  actualizarVisibilidadTipo(pregunta.tipo);

  if (pregunta.tipo === "opcion") {
    (pregunta.opciones || []).forEach((op, idx) => {
      const el = document.getElementById(`opcion-texto-${idx}`);
      if (el) el.value = op;
    });
    const radio = document.getElementById(`correcta-${pregunta.correcta}`);
    if (radio) radio.checked = true;
  } else if (pregunta.tipo === "vf") {
    selectVfCorrecta.value = String(Boolean(pregunta.correcta));
  } else if (pregunta.tipo === "completar") {
    inputCompletarCorrecta.value = pregunta.correcta || "";
  }

  modalPregunta.classList.remove("oculto");
  inputEnunciado.focus();
}

function cerrarModalPregunta() {
  modalPregunta.classList.add("oculto");
  formPregunta.reset();
  preguntaEditandoId = null;
}

btnCerrarModal.addEventListener("click", cerrarModalPregunta);
btnCancelarModal.addEventListener("click", cerrarModalPregunta);

formPregunta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipo = inputTipo.value;
  const enunciado = inputEnunciado.value.trim();
  const nivel = Number(inputNivel.value);
  const estado = inputEstado.value;
  const retroalimentacion = inputRetroalimentacion.value.trim();

  if (!enunciado) {
    ui.aviso("El enunciado es obligatorio", "error");
    return;
  }

  let opciones = [];
  let correcta = null;

  if (tipo === "opcion") {
    for (let i = 0; i < 4; i++) {
      const val = document.getElementById(`opcion-texto-${i}`).value.trim();
      if (!val) {
        ui.aviso(`La opción ${i + 1} es obligatoria`, "error");
        return;
      }
      opciones.push(val);
    }
    const radioSel = document.querySelector('input[name="opcion-correcta"]:checked');
    correcta = radioSel ? Number(radioSel.value) : 0;
  } else if (tipo === "vf") {
    opciones = ["Verdadero", "Falso"];
    correcta = selectVfCorrecta.value === "true";
  } else if (tipo === "completar") {
    correcta = inputCompletarCorrecta.value.trim();
    if (!correcta) {
      ui.aviso("Debes ingresar la palabra o frase correcta para completar", "error");
      return;
    }
  }

  const datos = {
    temaId: temaActivoId,
    nivel,
    tipo,
    enunciado,
    opciones,
    correcta,
    retroalimentacion,
    estado,
    origen: "docente"
  };

  ui.cargando(true);
  try {
    if (preguntaEditandoId) {
      const actualizada = await api.actualizar("preguntas", preguntaEditandoId, datos);
      const idx = todasPreguntas.findIndex((p) => p.id === preguntaEditandoId);
      if (idx >= 0) todasPreguntas[idx] = actualizada;
      ui.aviso("Pregunta actualizada con éxito", "exito");
    } else {
      const creada = await api.crear("preguntas", datos);
      todasPreguntas.push(creada);
      ui.aviso("Pregunta creada con éxito", "exito");
    }

    cerrarModalPregunta();
    renderizarPreguntas();
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la pregunta", "error");
  } finally {
    ui.cargando(false);
  }
});

async function eliminarPregunta(id) {
  const confirmado = await ui.confirmar("¿Deseas eliminar permanentemente esta pregunta?");
  if (!confirmado) return;

  ui.cargando(true);
  try {
    await api.eliminar("preguntas", id);
    todasPreguntas = todasPreguntas.filter((p) => p.id !== id);
    ui.aviso("Pregunta eliminada", "exito");
    renderizarPreguntas();
  } catch (err) {
    ui.aviso(err.message || "Error al eliminar la pregunta", "error");
  } finally {
    ui.cargando(false);
  }
}

// Modal de Generación con IA
btnGenerarIa.addEventListener("click", () => {
  if (!temaActivoId) {
    ui.aviso("Selecciona primero un tema para generar preguntas", "advertencia");
    return;
  }
  iaFormularioParametros.classList.remove("oculto");
  iaBloquePropuestas.classList.add("oculto");
  modalIa.classList.remove("oculto");
});

function cerrarModalIa() {
  modalIa.classList.add("oculto");
  propuestasActuales = [];
}

btnCerrarIa.addEventListener("click", cerrarModalIa);
btnCancelarIaForm.addEventListener("click", cerrarModalIa);
btnFinalizarIa.addEventListener("click", cerrarModalIa);

btnIniciarGeneracion.addEventListener("click", async () => {
  const cantidad = Number(inputIaCantidad.value) || 5;

  ui.cargando(true);
  try {
    const propuestas = await api.ia("generar-preguntas", {
      temaId: temaActivoId,
      nivel: nivelActivo,
      cantidad
    });

    if (!Array.isArray(propuestas) || propuestas.length === 0) {
      ui.aviso("La IA no devolvió preguntas para este tema", "advertencia");
      return;
    }

    propuestasActuales = propuestas;
    iaFormularioParametros.classList.add("oculto");
    iaBloquePropuestas.classList.remove("oculto");
    renderizarPropuestasIa();
  } catch (err) {
    ui.aviso(err.message || "Error al generar preguntas con IA", "error");
  } finally {
    ui.cargando(false);
  }
});

function renderizarPropuestasIa() {
  contenedorPropuestasIa.innerHTML = "";

  if (propuestasActuales.length === 0) {
    contenedorPropuestasIa.innerHTML = '<p class="texto-suave">Todas las propuestas han sido procesadas.</p>';
    return;
  }

  propuestasActuales.forEach((prop, index) => {
    const item = document.createElement("div");
    item.className = "item-propuesta-ia";

    let textoRespuesta = "";
    if (prop.tipo === "opcion") {
      textoRespuesta = (prop.opciones || [])
        .map((o, idx) => `${Number(prop.correcta) === idx ? "✓" : "○"} ${ui.escapar(o)}`)
        .join("<br>");
    } else if (prop.tipo === "vf") {
      textoRespuesta = `Correcta: ${prop.correcta ? "Verdadero" : "Falso"}`;
    } else {
      textoRespuesta = `Completar con: ${ui.escapar(prop.correcta)}`;
    }

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="insignia insignia--acento">${ui.escapar(prop.tipo)}</span>
        <span class="texto-suave">Propuesta ${index + 1} de ${propuestasActuales.length}</span>
      </div>
      <div><strong>${ui.escapar(prop.enunciado)}</strong></div>
      <div class="tarjeta-pregunta__respuestas">${textoRespuesta}</div>
      ${prop.retroalimentacion ? `<small class="texto-suave">${ui.escapar(prop.retroalimentacion)}</small>` : ""}
      <div class="item-propuesta-ia__acciones">
        <button type="button" class="btn btn--peligro btn--pequeno btn-descartar-ia">Descartar</button>
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar-ia">Editar antes de guardar</button>
        <button type="button" class="btn btn--primario btn--pequeno btn-aprobar-ia">Aprobar e incorporar</button>
      </div>
    `;

    item.querySelector(".btn-descartar-ia").addEventListener("click", () => {
      propuestasActuales.splice(index, 1);
      renderizarPropuestasIa();
    });

    item.querySelector(".btn-editar-ia").addEventListener("click", () => {
      cerrarModalIa();
      abrirModalEdicion({
        ...prop,
        temaId: temaActivoId,
        nivel: nivelActivo,
        origen: "ia",
        estado: "aprobado"
      });
    });

    item.querySelector(".btn-aprobar-ia").addEventListener("click", async () => {
      ui.cargando(true);
      try {
        const datos = {
          temaId: temaActivoId,
          nivel: nivelActivo,
          tipo: prop.tipo,
          enunciado: prop.enunciado,
          opciones: prop.opciones,
          correcta: prop.correcta,
          retroalimentacion: prop.retroalimentacion || "",
          origen: "ia",
          estado: "aprobado"
        };
        const creada = await api.crear("preguntas", datos);
        todasPreguntas.push(creada);
        propuestasActuales.splice(index, 1);
        ui.aviso("Pregunta aprobada e incorporada", "exito");
        renderizarPropuestasIa();
        renderizarPreguntas();
      } catch (err) {
        ui.aviso(err.message || "Error al aprobar la pregunta", "error");
      } finally {
        ui.cargando(false);
      }
    });

    contenedorPropuestasIa.appendChild(item);
  });
}

btnAprobarTodasIa.addEventListener("click", async () => {
  if (propuestasActuales.length === 0) return;

  ui.cargando(true);
  let guardadas = 0;
  try {
    for (const prop of [...propuestasActuales]) {
      const datos = {
        temaId: temaActivoId,
        nivel: nivelActivo,
        tipo: prop.tipo,
        enunciado: prop.enunciado,
        opciones: prop.opciones,
        correcta: prop.correcta,
        retroalimentacion: prop.retroalimentacion || "",
        origen: "ia",
        estado: "aprobado"
      };
      const creada = await api.crear("preguntas", datos);
      todasPreguntas.push(creada);
      guardadas++;
    }
    propuestasActuales = [];
    ui.aviso(`Se aprobaron ${guardadas} preguntas con éxito`, "exito");
    cerrarModalIa();
    renderizarPreguntas();
  } catch (err) {
    ui.aviso(err.message || "Error al aprobar las preguntas", "error");
  } finally {
    ui.cargando(false);
  }
});

btnNuevaPregunta.addEventListener("click", abrirModalCreacion);

selectTema.addEventListener("change", () => {
  temaActivoId = selectTema.value;
  renderizarPreguntas();
});

// Configuración de IA (Solo rol admin)
const usuarioSesion = usuarioActual();
const cfgIaModeloOtro = document.getElementById("cfg-ia-modelo-otro");
const cfgContenedorOtroModelo = document.getElementById("cfg-contenedor-otro-modelo");

function obtenerModeloConfig() {
  if (cfgIaModelo?.value === "otro") {
    return (cfgIaModeloOtro?.value || "").trim();
  }
  return (cfgIaModelo?.value || "").trim();
}

function fijarModeloConfig(modelo) {
  if (!cfgIaModelo) return;
  const opciones = Array.from(cfgIaModelo.options).map((o) => o.value);
  if (opciones.includes(modelo)) {
    cfgIaModelo.value = modelo;
    cfgContenedorOtroModelo?.classList.add("oculto");
  } else {
    cfgIaModelo.value = "otro";
    if (cfgIaModeloOtro) cfgIaModeloOtro.value = modelo || "";
    cfgContenedorOtroModelo?.classList.remove("oculto");
  }
}

cfgIaModelo?.addEventListener("change", () => {
  const esOtro = cfgIaModelo.value === "otro";
  cfgContenedorOtroModelo?.classList.toggle("oculto", !esOtro);
  if (esOtro && cfgIaModeloOtro) cfgIaModeloOtro.focus();
});

if (usuarioSesion && usuarioSesion.rol === "admin" && btnConfigurarIa) {
  btnConfigurarIa.classList.remove("oculto");

  btnConfigurarIa.addEventListener("click", async () => {
    cfgIaResultadoPrueba.classList.add("oculto");
    cfgIaResultadoPrueba.textContent = "";
    ui.cargando(true);
    try {
      const config = await api.llamar("GET", "/api/ia/config");
      if (cfgIaProveedor) cfgIaProveedor.value = config.proveedor || "gemini";
      fijarModeloConfig(config.modelo || "gemini-1.5-flash");
      if (cfgIaClave) cfgIaClave.value = config.clave || "";
      if (cfgIaLimite) cfgIaLimite.value = config.limiteIADiario || 30;
      modalConfigIa.classList.remove("oculto");
    } catch (err) {
      ui.aviso(err.message || "Error al cargar la configuración de IA", "error");
    } finally {
      ui.cargando(false);
    }
  });

  btnCerrarConfigIa?.addEventListener("click", () => {
    modalConfigIa.classList.add("oculto");
  });

  btnToggleVerClave?.addEventListener("click", () => {
    if (cfgIaClave.type === "password") {
      cfgIaClave.type = "text";
      btnToggleVerClave.textContent = "🔒";
    } else {
      cfgIaClave.type = "password";
      btnToggleVerClave.textContent = "👁️";
    }
  });

  btnProbarIa?.addEventListener("click", async () => {
    const clave = (cfgIaClave?.value || "").trim();
    if (!clave) {
      cfgIaResultadoPrueba.className = "alerta alerta--error";
      cfgIaResultadoPrueba.textContent = "❌ Por favor ingresa la clave de API antes de probar la conexión.";
      cfgIaResultadoPrueba.classList.remove("oculto");
      return;
    }

    if (clave.length < 25) {
      cfgIaResultadoPrueba.className = "alerta alerta--advertencia";
      cfgIaResultadoPrueba.textContent = `⚠️ La clave ingresada parece incompleta (tiene ${clave.length} caracteres). Las claves completas de Gemini (iniciadas en 'AQ.' o 'AIzaSy...') tienen entre 39 y 45 caracteres. Asegúrate de copiar y pegar la clave completa.`;
      cfgIaResultadoPrueba.classList.remove("oculto");
      return;
    }

    cfgIaResultadoPrueba.className = "alerta alerta--info";
    cfgIaResultadoPrueba.textContent = "Probando conexión con Gemini...";
    cfgIaResultadoPrueba.classList.remove("oculto");
    try {
      const resp = await api.llamar("POST", "/api/ia/prueba", {
        proveedor: cfgIaProveedor.value,
        modelo: obtenerModeloConfig(),
        clave
      });
      if (resp.ok) {
        cfgIaResultadoPrueba.className = "alerta alerta--exito";
        cfgIaResultadoPrueba.textContent = `✅ ${resp.mensaje}: "${resp.respuesta || "Respuesta recibida"}"`;
      } else {
        cfgIaResultadoPrueba.className = "alerta alerta--error";
        cfgIaResultadoPrueba.textContent = `❌ ${resp.error || "Fallo en la prueba"}`;
      }
    } catch (err) {
      cfgIaResultadoPrueba.className = "alerta alerta--error";
      cfgIaResultadoPrueba.textContent = `❌ Error: ${err.message}`;
    }
  });

  formConfigIa?.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.cargando(true);
    try {
      const resp = await api.llamar("PUT", "/api/ia/config", {
        proveedor: cfgIaProveedor.value,
        modelo: obtenerModeloConfig(),
        clave: cfgIaClave.value.trim(),
        limiteIADiario: Number(cfgIaLimite.value) || 30
      });
      ui.aviso(resp.mensaje || "Configuración de IA guardada correctamente", "exito");
      modalConfigIa.classList.add("oculto");
    } catch (err) {
      ui.aviso(err.message || "Error al guardar configuración", "error");
    } finally {
      ui.cargando(false);
    }
  });
}

async function inicializar() {
  ui.cargando(true);
  try {
    const [resTemas, resPreguntas] = await Promise.all([
      api.listar("temas"),
      api.listar("preguntas").catch(() => [])
    ]);

    temas = resTemas;
    todasPreguntas = resPreguntas;

    selectTema.innerHTML = '<option value="">Selecciona un tema...</option>';
    temas.forEach((tema) => {
      const opt = document.createElement("option");
      opt.value = tema.id;
      opt.textContent = tema.titulo;
      selectTema.appendChild(opt);
    });

    if (temaIdUrl && temas.some((t) => t.id === temaIdUrl)) {
      selectTema.value = temaIdUrl;
      temaActivoId = temaIdUrl;
    } else if (temas.length > 0) {
      selectTema.value = temas[0].id;
      temaActivoId = temas[0].id;
    }

    renderizarPreguntas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar los datos del banco", "error");
  } finally {
    ui.cargando(false);
  }
}

inicializar();
