// publico/js/nucleo/selector-tema.js · Selección de tema para actividades educativas
import * as api from "./api.js";
import * as ui from "./ui.js";

/**
 * Obtiene el tema para la actividad actual según ?temaId= o mostrando un selector accesible
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
      // Si falla o no existe, continuar con el selector
    }
  }

  let temas = [];
  try {
    temas = await api.listar("temas");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar los temas", "error");
    throw err;
  }

  if (temas.length === 0) {
    const errorVacio = new Error("No hay temas disponibles actualmente");
    ui.aviso(errorVacio.message, "advertencia");
    throw errorVacio;
  }

  if (temas.length === 1) {
    return temas[0];
  }

  // Si hay varios temas y no vino ?temaId=, mostrar modal selector
  return new Promise((resolve) => {
    const contenedor = document.createElement("div");
    contenedor.className = "pila";

    const label = document.createElement("label");
    label.className = "etiqueta";
    label.setAttribute("for", "selector-modal-tema");
    label.textContent = "Selecciona un tema para continuar:";

    const select = document.createElement("select");
    select.id = "selector-modal-tema";
    select.className = "entrada";

    temas.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.titulo;
      select.appendChild(opt);
    });

    contenedor.appendChild(label);
    contenedor.appendChild(select);

    ui.modal({
      titulo: "Seleccionar Tema",
      contenido: contenedor,
      acciones: [
        {
          texto: "Continuar",
          tipo: "principal",
          valor: true
        }
      ]
    }).then(() => {
      const elegidoId = select.value;
      const temaElegido = temas.find((t) => t.id === elegidoId) || temas[0];
      resolve(temaElegido);
    });
  });
}
