// publico/js/nucleo/ui.js · Componentes e interfaz accesible para el usuario
export function escapar(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function limpiar(html) {
  if (html === null || html === undefined) return "";
  if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

let contenedorAvisos = null;

function asegurarContenedorAvisos() {
  if (contenedorAvisos && document.body.contains(contenedorAvisos)) {
    return contenedorAvisos;
  }
  contenedorAvisos = document.getElementById("contenedor-avisos");
  if (!contenedorAvisos) {
    contenedorAvisos = document.createElement("div");
    contenedorAvisos.id = "contenedor-avisos";
    contenedorAvisos.className = "contenedor-avisos";
    contenedorAvisos.setAttribute("aria-live", "polite");
    contenedorAvisos.setAttribute("aria-atomic", "false");
    document.body.appendChild(contenedorAvisos);
  }
  return contenedorAvisos;
}

export function aviso(texto, tipo = "info") {
  if (typeof document === "undefined") return;
  const contenedor = asegurarContenedorAvisos();
  const elemento = document.createElement("div");
  elemento.className = `aviso aviso--${tipo}`;
  elemento.setAttribute("role", "status");
  elemento.textContent = texto;

  contenedor.appendChild(elemento);

  setTimeout(() => {
    elemento.classList.add("desvanecer");
    setTimeout(() => {
      if (elemento.parentNode) {
        elemento.parentNode.removeChild(elemento);
      }
    }, 300);
  }, 4000);
}

let indicadorCargando = null;

export function cargando(activo) {
  if (typeof document === "undefined") return;
  if (activo) {
    if (!indicadorCargando || !document.body.contains(indicadorCargando)) {
      indicadorCargando = document.createElement("div");
      indicadorCargando.className = "cargando";
      indicadorCargando.setAttribute("role", "progressbar");
      indicadorCargando.setAttribute("aria-label", "Cargando contenido");
      document.body.appendChild(indicadorCargando);
    }
  } else {
    if (indicadorCargando && indicadorCargando.parentNode) {
      indicadorCargando.parentNode.removeChild(indicadorCargando);
      indicadorCargando = null;
    }
  }
}

export function modal({ titulo, contenido, acciones = [] }) {
  if (typeof document === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const elementoPrevio = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("role", "presentation");

    const dialogo = document.createElement("div");
    dialogo.className = "modal";
    dialogo.setAttribute("role", "dialog");
    dialogo.setAttribute("aria-modal", "true");

    const tituloId = `modal-titulo-${Date.now()}`;
    dialogo.setAttribute("aria-labelledby", tituloId);

    const cabecera = document.createElement("div");
    cabecera.className = "modal-cabecera";

    const h2 = document.createElement("h2");
    h2.id = tituloId;
    h2.className = "modal-titulo";
    h2.textContent = titulo;
    cabecera.appendChild(h2);

    const btnCerrar = document.createElement("button");
    btnCerrar.type = "button";
    btnCerrar.className = "modal-cerrar";
    btnCerrar.setAttribute("aria-label", "Cerrar ventana");
    btnCerrar.textContent = "×";
    cabecera.appendChild(btnCerrar);

    const cuerpo = document.createElement("div");
    cuerpo.className = "modal-cuerpo";
    if (typeof contenido === "string") {
      cuerpo.textContent = contenido;
    } else if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    }

    const pie = document.createElement("div");
    pie.className = "modal-pie";

    const botones = [];
    if (acciones.length === 0) {
      acciones = [{ texto: "Aceptar", valor: true, tipo: "principal" }];
    }

    for (const acc of acciones) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `boton boton--${acc.tipo || "secundario"}`;
      btn.textContent = acc.texto;
      btn.addEventListener("click", () => cerrarConValor(acc.valor !== undefined ? acc.valor : true));
      pie.appendChild(btn);
      botones.push(btn);
    }

    dialogo.appendChild(cabecera);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    function obtenerElementosEnfocables() {
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(dialogo.querySelectorAll(selector)).filter((el) => !el.disabled && el.offsetParent !== null);
    }

    function cerrarConValor(valor) {
      document.removeEventListener("keydown", manejarTeclado);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (elementoPrevio && typeof elementoPrevio.focus === "function") {
        elementoPrevio.focus();
      }
      resolve(valor);
    }

    function manejarTeclado(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarConValor(null);
        return;
      }

      if (e.key === "Tab") {
        const enfocables = obtenerElementosEnfocables();
        if (enfocables.length === 0) {
          e.preventDefault();
          return;
        }

        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
          }
        }
      }
    }

    btnCerrar.addEventListener("click", () => cerrarConValor(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cerrarConValor(null);
      }
    });

    document.addEventListener("keydown", manejarTeclado);

    // Foco inicial
    const enfocarInicial = botones[0] || btnCerrar;
    if (enfocarInicial) {
      enfocarInicial.focus();
    }
  });
}

export async function confirmar(texto) {
  const respuesta = await modal({
    titulo: "Confirmación",
    contenido: texto,
    acciones: [
      { texto: "Cancelar", valor: false, tipo: "secundario" },
      { texto: "Aceptar", valor: true, tipo: "principal" }
    ]
  });
  return Boolean(respuesta);
}
