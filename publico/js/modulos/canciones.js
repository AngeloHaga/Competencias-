// publico/js/modulos/canciones.js · Reproductor musical educativo con sincronización de letra LRC
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { usuarioActual } from "../nucleo/sesion.js";

await montarPlantilla({ titulo: "Canciones", roles: ["sesion"] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === "docente" || usuario.rol === "admin");

// Parámetro de inicio opcional
const temaIdParam = util.parametro("temaId");

// Elementos DOM
const contenedorBotonNueva = document.getElementById("contenedorBotonNueva");
const filtroAsignatura = document.getElementById("filtroAsignatura");
const filtroTema = document.getElementById("filtroTema");
const contadorCanciones = document.getElementById("contadorCanciones");
const listaCanciones = document.getElementById("listaCanciones");

const bloqueSinSeleccion = document.getElementById("bloqueSinSeleccion");
const bloqueReproductorActivo = document.getElementById("bloqueReproductorActivo");

// Elementos del reproductor
const repTemaNombre = document.getElementById("repTemaNombre");
const repTituloCancion = document.getElementById("repTituloCancion");
const repAutoria = document.getElementById("repAutoria");
const repLicencia = document.getElementById("repLicencia");

const elementoAudio = document.getElementById("elementoAudio");
const tiempoActual = document.getElementById("tiempoActual");
const tiempoTotal = document.getElementById("tiempoTotal");
const barraProgreso = document.getElementById("barraProgreso");
const btnPlayPausa = document.getElementById("btnPlayPausa");
const btnSilenciar = document.getElementById("btnSilenciar");
const controlVolumen = document.getElementById("controlVolumen");

const badgeSincronizada = document.getElementById("badgeSincronizada");
const contenedorLetra = document.getElementById("contenedorLetra");

if (esDocenteOAdmin && contenedorBotonNueva) {
  contenedorBotonNueva.style.display = "block";
}

let todasCanciones = [];
let todosTemas = [];
let todasUnidades = [];
let todasAsignaturas = [];

let cancionSeleccionada = null;
let lineasLrcParseadas = [];
let indiceLrcActivo = -1;
let usuarioArrastrandoProgreso = false;

async function inicializar() {
  ui.cargando(true);
  try {
    const [cancionesData, temasData, unidadesData, asignaturasData] = await Promise.all([
      api.listar("canciones"),
      api.listar("temas"),
      api.listar("unidades"),
      api.listar("asignaturas")
    ]);

    todasCanciones = cancionesData;
    todosTemas = temasData;
    todasUnidades = unidadesData;
    todasAsignaturas = asignaturasData;

    poblarFiltros();

    // Si viene temaId en la URL, seleccionar la asignatura correspondiente y el tema
    if (temaIdParam) {
      const temaEncontrado = todosTemas.find((t) => t.id === temaIdParam);
      if (temaEncontrado) {
        const unidad = todasUnidades.find((u) => u.id === temaEncontrado.unidadId);
        if (unidad && unidad.asignaturaId) {
          filtroAsignatura.value = unidad.asignaturaId;
          actualizarOpcionesTemas();
        }
        filtroTema.value = temaIdParam;
      }
    }

    renderizarLista();

    // Si hay canciones y venía temaId, seleccionar la primera coincidente
    const filtradas = obtenerCancionesFiltradas();
    if (filtradas.length > 0) {
      seleccionarCancion(filtradas[0]);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar canciones", "error");
    listaCanciones.innerHTML = `<div class="tarjeta-vacia">No se pudieron cargar las canciones.</div>`;
  } finally {
    ui.cargando(false);
  }

  configurarControlesAudio();
}

function poblarFiltros() {
  filtroAsignatura.innerHTML = '<option value="">Todas las asignaturas</option>';
  for (const a of todasAsignaturas) {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.nombre || a.id;
    filtroAsignatura.appendChild(opt);
  }

  actualizarOpcionesTemas();

  filtroAsignatura.addEventListener("change", () => {
    actualizarOpcionesTemas();
    renderizarLista();
  });

  filtroTema.addEventListener("change", () => {
    renderizarLista();
  });
}

function actualizarOpcionesTemas() {
  const asigId = filtroAsignatura.value;
  filtroTema.innerHTML = '<option value="">Todos los temas</option>';

  let temasFiltrados = todosTemas;
  if (asigId) {
    const idsUnidades = new Set(
      todasUnidades.filter((u) => u.asignaturaId === asigId).map((u) => u.id)
    );
    temasFiltrados = todosTemas.filter((t) => idsUnidades.has(t.unidadId));
  }

  for (const t of temasFiltrados) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.titulo || `Tema ${t.id}`;
    filtroTema.appendChild(opt);
  }
}

function obtenerCancionesFiltradas() {
  const asigId = filtroAsignatura.value;
  const temaId = filtroTema.value;

  let temasValidos = new Set();
  if (asigId) {
    const idsUnidades = new Set(
      todasUnidades.filter((u) => u.asignaturaId === asigId).map((u) => u.id)
    );
    temasValidos = new Set(
      todosTemas.filter((t) => idsUnidades.has(t.unidadId)).map((t) => t.id)
    );
  }

  return todasCanciones.filter((c) => {
    if (temaId && c.temaId !== temaId) return false;
    if (asigId && !temasValidos.has(c.temaId)) return false;
    return true;
  });
}

function renderizarLista() {
  const canciones = obtenerCancionesFiltradas();
  contadorCanciones.textContent = `${canciones.length} ${canciones.length === 1 ? "canción" : "canciones"}`;

  if (canciones.length === 0) {
    listaCanciones.innerHTML = `
      <div class="tarjeta-vacia">
        <p>No hay canciones registradas para los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  listaCanciones.innerHTML = canciones
    .map((c) => {
      const esActiva = cancionSeleccionada && cancionSeleccionada.id === c.id;
      const tema = todosTemas.find((t) => t.id === c.temaId);
      const nombreTema = tema ? tema.titulo : "Tema general";

      return `
        <article class="item-cancion ${esActiva ? "item-cancion--activa" : ""}" data-id="${ui.escapar(c.id)}" role="button" tabindex="0">
          <div class="item-cancion__cabecera">
            <h3 class="item-cancion__titulo">${ui.escapar(c.titulo || "Sin título")}</h3>
            ${c.lrc ? '<span class="insignia insignia--secundario" title="Incluye letra sincronizada">LRC</span>' : ""}
          </div>

          <span class="texto-xs texto-suave">${ui.escapar(nombreTema)}</span>

          <div class="item-cancion__pie">
            <span class="texto-xs texto-suave">${ui.escapar(c.autoria || "Autor no especificado")}</span>
            <div style="display: flex; gap: var(--espacio-xs); align-items: center;">
              ${
                esDocenteOAdmin
                  ? `<a href="/paginas/editor-cancion.html?id=${encodeURIComponent(c.id)}" class="btn btn--texto btn--pequeno" onclick="event.stopPropagation();">Editar</a>`
                  : ""
              }
              <button type="button" class="btn btn--secundario btn--pequeno btnEscuchar" data-id="${ui.escapar(c.id)}">
                ${esActiva ? "Sonando ♪" : "Escuchar"}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  listaCanciones.querySelectorAll(".item-cancion").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      const c = todasCanciones.find((item) => item.id === id);
      if (c) seleccionarCancion(c, true);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = el.getAttribute("data-id");
        const c = todasCanciones.find((item) => item.id === id);
        if (c) seleccionarCancion(c, true);
      }
    });
  });
}

function seleccionarCancion(cancion, reproducirInmediato = false) {
  cancionSeleccionada = cancion;

  // Actualizar clases activas en la lista
  listaCanciones.querySelectorAll(".item-cancion").forEach((el) => {
    if (el.getAttribute("data-id") === cancion.id) {
      el.classList.add("item-cancion--activa");
    } else {
      el.classList.remove("item-cancion--activa");
    }
  });

  // Mostrar bloque de reproductor
  bloqueSinSeleccion.style.display = "none";
  bloqueReproductorActivo.style.display = "flex";

  // Metadatos
  const tema = todosTemas.find((t) => t.id === cancion.temaId);
  repTemaNombre.textContent = tema ? tema.titulo : "Tema curricular";
  repTituloCancion.textContent = cancion.titulo || "Sin título";
  repAutoria.textContent = cancion.autoria ? `Autoría: ${cancion.autoria}` : "";
  repLicencia.textContent = cancion.licencia || "Licencia no especificada";

  // Cargar audio
  elementoAudio.src = cancion.audio || "";
  barraProgreso.value = 0;
  tiempoActual.textContent = "00:00";
  tiempoTotal.textContent = "00:00";
  btnPlayPausa.textContent = "▶";
  btnPlayPausa.setAttribute("aria-label", "Reproducir");

  // Parsear y cargar letra
  cargarLetra(cancion);

  if (reproducirInmediato && cancion.audio) {
    elementoAudio.play().then(() => {
      btnPlayPausa.textContent = "❚❚";
      btnPlayPausa.setAttribute("aria-label", "Pausar");
    }).catch(() => {
      // Manejar bloqueo de reproducción automática del navegador
    });
  }
}

// -------------------------------------------------------------------
// PARSER Y SINCRONIZACIÓN LRC
// -------------------------------------------------------------------

function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== "string") return [];

  const lineas = lrcTexto.split("\n");
  const resultado = [];

  // Expresión para [mm:ss.xx] o [mm:ss]
  const lrcRegex = /\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\](.*)/;

  for (const linea of lineas) {
    const match = linea.match(lrcRegex);
    if (match) {
      const minutos = parseInt(match[1], 10);
      const segundos = parseFloat(match[2]);
      const tiempoSeg = minutos * 60 + segundos;
      const texto = match[3].trim();

      if (texto) {
        resultado.push({ tiempo: tiempoSeg, texto });
      }
    }
  }

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

function cargarLetra(cancion) {
  lineasLrcParseadas = [];
  indiceLrcActivo = -1;

  if (cancion.lrc) {
    lineasLrcParseadas = parsearLRC(cancion.lrc);
  }

  if (lineasLrcParseadas.length > 0) {
    badgeSincronizada.style.display = "inline-flex";
    contenedorLetra.innerHTML = lineasLrcParseadas
      .map(
        (linea, idx) => `
        <div class="letra-linea-lrc" id="lineaLrc-${idx}" data-idx="${idx}" data-tiempo="${linea.tiempo}">
          ${ui.escapar(linea.texto)}
        </div>
      `
      )
      .join("");

    // Permitir hacer clic en una línea para adelantar el audio
    contenedorLetra.querySelectorAll(".letra-linea-lrc").forEach((el) => {
      el.addEventListener("click", () => {
        const t = parseFloat(el.getAttribute("data-tiempo"));
        if (!isNaN(t)) {
          elementoAudio.currentTime = t;
          if (elementoAudio.paused) {
            elementoAudio.play();
          }
        }
      });
    });
  } else {
    badgeSincronizada.style.display = "none";
    const letraTexto = cancion.letra || "No se ha proporcionado letra para esta canción.";
    contenedorLetra.innerHTML = `<div class="letra-plana-texto">${ui.escapar(letraTexto)}</div>`;
  }
}

function actualizarSincronizacionLRC(tiempoSegundos) {
  if (lineasLrcParseadas.length === 0) return;

  // Encontrar la línea con tiempo más cercano menor o igual al actual
  let nuevoIndice = -1;
  for (let i = 0; i < lineasLrcParseadas.length; i++) {
    if (tiempoSegundos >= lineasLrcParseadas[i].tiempo) {
      nuevoIndice = i;
    } else {
      break;
    }
  }

  if (nuevoIndice !== indiceLrcActivo) {
    // Remover clase anterior
    if (indiceLrcActivo >= 0) {
      const prevEl = document.getElementById(`lineaLrc-${indiceLrcActivo}`);
      if (prevEl) prevEl.classList.remove("letra-linea-lrc--activa");
    }

    indiceLrcActivo = nuevoIndice;

    if (indiceLrcActivo >= 0) {
      const actEl = document.getElementById(`lineaLrc-${indiceLrcActivo}`);
      if (actEl) {
        actEl.classList.add("letra-linea-lrc--activa");

        // Desplazamiento suave centrado
        actEl.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }
  }
}

// -------------------------------------------------------------------
// CONTROLES DEL REPRODUCTOR ACCESIBLE
// -------------------------------------------------------------------

function formatearTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return "00:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function configurarControlesAudio() {
  btnPlayPausa.addEventListener("click", alternarReproduccion);

  elementoAudio.addEventListener("loadedmetadata", () => {
    tiempoTotal.textContent = formatearTiempo(elementoAudio.duration);
  });

  elementoAudio.addEventListener("timeupdate", () => {
    if (!usuarioArrastrandoProgreso && elementoAudio.duration) {
      const porcentaje = (elementoAudio.currentTime / elementoAudio.duration) * 100;
      barraProgreso.value = porcentaje;
      tiempoActual.textContent = formatearTiempo(elementoAudio.currentTime);
    }
    actualizarSincronizacionLRC(elementoAudio.currentTime);
  });

  elementoAudio.addEventListener("ended", () => {
    btnPlayPausa.textContent = "▶";
    btnPlayPausa.setAttribute("aria-label", "Reproducir");
    barraProgreso.value = 0;
    tiempoActual.textContent = "00:00";
  });

  // Barra de progreso operable
  barraProgreso.addEventListener("input", () => {
    usuarioArrastrandoProgreso = true;
    if (elementoAudio.duration) {
      const tiempoDestino = (barraProgreso.value / 100) * elementoAudio.duration;
      tiempoActual.textContent = formatearTiempo(tiempoDestino);
    }
  });

  barraProgreso.addEventListener("change", () => {
    if (elementoAudio.duration) {
      elementoAudio.currentTime = (barraProgreso.value / 100) * elementoAudio.duration;
    }
    usuarioArrastrandoProgreso = false;
  });

  // Control de volumen y silencio
  controlVolumen.addEventListener("input", () => {
    elementoAudio.volume = parseFloat(controlVolumen.value);
    actualizarIconoVolumen();
  });

  btnSilenciar.addEventListener("click", () => {
    elementoAudio.muted = !elementoAudio.muted;
    actualizarIconoVolumen();
  });

  // Atajos de teclado en el contenedor de audio
  document.addEventListener("keydown", (e) => {
    // Si no está escribiendo en un input o textarea
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

    if (cancionSeleccionada) {
      if (e.code === "Space") {
        e.preventDefault();
        alternarReproduccion();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        elementoAudio.currentTime = Math.min(elementoAudio.currentTime + 5, elementoAudio.duration || 0);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        elementoAudio.currentTime = Math.max(elementoAudio.currentTime - 5, 0);
      }
    }
  });
}

function alternarReproduccion() {
  if (!elementoAudio.src) return;

  if (elementoAudio.paused) {
    elementoAudio.play().then(() => {
      btnPlayPausa.textContent = "❚❚";
      btnPlayPausa.setAttribute("aria-label", "Pausar");
    }).catch((err) => {
      ui.aviso(err.message || "Error al reproducir audio", "error");
    });
  } else {
    elementoAudio.pause();
    btnPlayPausa.textContent = "▶";
    btnPlayPausa.setAttribute("aria-label", "Reproducir");
  }
}

function actualizarIconoVolumen() {
  if (elementoAudio.muted || elementoAudio.volume === 0) {
    btnSilenciar.textContent = "🔇";
  } else if (elementoAudio.volume < 0.5) {
    btnSilenciar.textContent = "🔉";
  } else {
    btnSilenciar.textContent = "🔊";
  }
}

await inicializar();
