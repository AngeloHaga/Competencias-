// publico/js/nucleo/selector-tema.js · Selección de tema para actividades educativas
import * as api from "./api.js";
import * as ui from "./ui.js";

/**
 * Obtiene el tema para la actividad actual:
 * Si hay ?temaId= devuelve ese tema.
 * Si no, abre un modal con selects asignatura → unidad → tema (solo publicados) y devuelve el elegido.
 * @returns {Promise<Object>}
 */
export async function obtenerTemaActividad() {
  const parametros = new URLSearchParams(window.location.search);
  const temaIdUrl = parametros.get("temaId");

  if (temaIdUrl) {
    try {
      const tema = await api.obtener("temas", temaIdUrl);
      if (tema) return tema;
    } catch {
      // Si falla o no existe el id proporcionado, continuar con el selector
    }
  }

  // Cargar colecciones para el selector en cascada: asignaturas, unidades y temas
  ui.cargando(true);
  let asignaturas = [];
  let unidades = [];
  let temas = [];

  try {
    const [todasAsig, todasUni, todosTemas] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("unidades"),
      api.listar("temas")
    ]);
    asignaturas = todasAsig;
    unidades = todasUni.filter((u) => u.visible !== false);
    // Solo temas publicados
    temas = todosTemas.filter((t) => t.estado === "publicado");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar los temas", "error");
    throw err;
  } finally {
    ui.cargando(false);
  }

  if (temas.length === 0) {
    const errorVacio = new Error("No hay temas publicados disponibles actualmente");
    ui.aviso(errorVacio.message, "advertencia");
    throw errorVacio;
  }

  if (temas.length === 1) {
    return temas[0];
  }

  // Construir selector modal con selects encadenados: asignatura → unidad → tema
  return new Promise((resolve) => {
    const contenedor = document.createElement("div");
    contenedor.className = "pila";

    // 1. Selector de Asignatura
    const grupoAsig = document.createElement("div");
    grupoAsig.className = "campo-formulario";
    const lblAsig = document.createElement("label");
    lblAsig.className = "etiqueta";
    lblAsig.setAttribute("for", "selector-modal-asig");
    lblAsig.textContent = "Asignatura:";
    const selAsig = document.createElement("select");
    selAsig.id = "selector-modal-asig";
    selAsig.className = "entrada";
    grupoAsig.appendChild(lblAsig);
    grupoAsig.appendChild(selAsig);

    // 2. Selector de Unidad
    const grupoUni = document.createElement("div");
    grupoUni.className = "campo-formulario";
    const lblUni = document.createElement("label");
    lblUni.className = "etiqueta";
    lblUni.setAttribute("for", "selector-modal-uni");
    lblUni.textContent = "Unidad:";
    const selUni = document.createElement("select");
    selUni.id = "selector-modal-uni";
    selUni.className = "entrada";
    grupoUni.appendChild(lblUni);
    grupoUni.appendChild(selUni);

    // 3. Selector de Tema
    const grupoTema = document.createElement("div");
    grupoTema.className = "campo-formulario";
    const lblTema = document.createElement("label");
    lblTema.className = "etiqueta";
    lblTema.setAttribute("for", "selector-modal-tema");
    lblTema.textContent = "Tema (publicado):";
    const selTema = document.createElement("select");
    selTema.id = "selector-modal-tema";
    selTema.className = "entrada";
    grupoTema.appendChild(lblTema);
    grupoTema.appendChild(selTema);

    contenedor.appendChild(grupoAsig);
    contenedor.appendChild(grupoUni);
    contenedor.appendChild(grupoTema);

    // Filtrar solo asignaturas que tengan unidades con temas publicados
    const unidadesConTemas = new Set(temas.map((t) => t.unidadId));
    const asigConTemas = new Set(
      unidades.filter((u) => unidadesConTemas.has(u.id)).map((u) => u.asignaturaId)
    );

    const asignaturasValidas = asignaturas.filter((a) => asigConTemas.has(a.id));
    const asigsParaMostrar = asignaturasValidas.length > 0 ? asignaturasValidas : asignaturas;

    asigsParaMostrar.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.nombre || a.id;
      selAsig.appendChild(opt);
    });

    function actualizarUnidades() {
      const asigId = selAsig.value;
      selUni.innerHTML = "";
      const unisFiltradas = unidades.filter(
        (u) => (!asigId || u.asignaturaId === asigId) && unidadesConTemas.has(u.id)
      );

      unisFiltradas.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.titulo || u.id;
        selUni.appendChild(opt);
      });

      actualizarTemas();
    }

    function actualizarTemas() {
      const uniId = selUni.value;
      selTema.innerHTML = "";
      const temasFiltrados = temas.filter((t) => !uniId || t.unidadId === uniId);

      temasFiltrados.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.titulo || t.id;
        selTema.appendChild(opt);
      });
    }

    selAsig.addEventListener("change", actualizarUnidades);
    selUni.addEventListener("change", actualizarTemas);

    // Inicializar selects
    actualizarUnidades();

    ui.modal({
      titulo: "Seleccionar tema para la actividad",
      contenido: contenedor,
      acciones: [
        {
          texto: "Comenzar actividad",
          tipo: "principal",
          valor: true
        }
      ]
    }).then(() => {
      const elegidoId = selTema.value;
      const temaElegido = temas.find((t) => t.id === elegidoId) || temas[0];
      resolve(temaElegido);
    });
  });
}

