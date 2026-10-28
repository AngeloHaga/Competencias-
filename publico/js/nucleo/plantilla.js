// publico/js/nucleo/plantilla.js · Montaje de encabezado, menú y pie de página
import { MENU } from "./menu.js";
import { exigirRol, usuarioActual, token, cerrar } from "./sesion.js";
import { registrarEvento } from "./bitacora.js";
import { aviso, escapar } from "./ui.js";

const NOMBRE = "Ecosistema Educativo";

/**
 * Monta la plantilla común de la aplicación
 * @param {Object} opciones
 * @param {string} [opciones.titulo=""] - Título de la página
 * @param {string|string[]} [opciones.roles] - Roles permitidos para acceder a la página
 */
export async function montarPlantilla({ titulo = "", roles } = {}) {
  // Exigir rol si se indican
  if (roles !== undefined && roles !== null) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // Título del documento
  document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;

  // Mostrar avisos pendientes (por ejemplo tras una redirección)
  if (typeof sessionStorage !== "undefined") {
    const avisoPendiente = sessionStorage.getItem("aviso_pendiente");
    if (avisoPendiente) {
      sessionStorage.removeItem("aviso_pendiente");
      try {
        const parsed = JSON.parse(avisoPendiente);
        aviso(parsed.texto, parsed.tipo || "advertencia");
      } catch {
        aviso(avisoPendiente, "advertencia");
      }
    }
  }

  const contenedorPlantilla = document.getElementById("plantilla");
  if (!contenedorPlantilla) return;

  const usuario = usuarioActual();
  const tieneSesion = !!(usuario && token());
  const rutaActual = window.location.pathname || "/";

  // Registrar visita a la página en bitácora si hay sesión activa (sin esperar respuesta)
  if (tieneSesion) {
    registrarEvento("pagina", rutaActual).catch(() => {});
  }

  // Filtrar el menú según los permisos del usuario
  const menuFiltrado = MENU.filter((item) => {
    const rolesItem = Array.isArray(item.roles) ? item.roles : ["publico"];
    if (rolesItem.includes("publico")) return true;
    if (!tieneSesion) return false;
    if (rolesItem.includes("sesion")) return true;
    return rolesItem.includes(usuario.rol);
  });

  // Enlaces de navegación con marcado de página actual y badge de noticias no leídas
  const enlacesHtml = menuFiltrado.map((item) => {
    const esActual =
      rutaActual === item.href ||
      (rutaActual === "/" && item.href === "/index.html") ||
      rutaActual.endsWith(item.href);

    const esNoticias = item.texto === "Noticias";
    const badgeHtml = esNoticias
      ? ' <span id="badgeNoticiasMenu" class="insignia insignia--acento" style="display: none; margin-left: var(--espacio-xs); font-size: var(--tamano-xs); padding: 2px 6px;"></span>'
      : '';

    return `<a href="${item.href}" ${esActual ? 'aria-current="page" class="activo"' : ""}>${escapar(item.texto)}${badgeHtml}</a>`;
  }).join("");

  // Acciones del encabezado según el estado de sesión
  let accionesHtml = "";
  if (tieneSesion) {
    const nombreCompleto = `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim() || "Usuario";
    accionesHtml = `
      <div class="encabezado-app__acciones">
        <a href="/paginas/perfil.html" class="encabezado-app__usuario" title="Ver mi perfil">
          <span class="encabezado-app__nombre-usuario">${escapar(nombreCompleto)}</span>
          <span class="insignia insignia--secundario">${escapar(usuario.rol || "")}</span>
        </a>
        <button type="button" class="btn btn--texto btn--pequeno" id="btnCerrarSesion" aria-label="Cerrar sesión">Salir</button>
      </div>
    `;
  } else {
    accionesHtml = `
      <div class="encabezado-app__acciones">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno">Registrarse</a>
      </div>
    `;
  }

  // Estructura completa de encabezado y menú lateral
  contenedorPlantilla.innerHTML = `
    <header class="encabezado-app" role="banner">
      <div class="encabezado-app__izquierda">
        <button type="button" class="btn-menu-movil" id="btnMenuMovil" aria-label="Abrir menú" aria-expanded="false">
          ☰
        </button>
        <div class="encabezado-app__info">
          <a href="/index.html" class="encabezado-app__nombre">${NOMBRE}</a>
          ${titulo ? `<span class="encabezado-app__separador" aria-hidden="true">·</span><span class="encabezado-app__titulo">${escapar(titulo)}</span>` : ""}
        </div>
      </div>
      ${accionesHtml}
    </header>

    <aside class="menu-lateral" id="menuLateral" aria-label="Menú principal">
      <nav class="menu-lateral__nav">
        ${enlacesHtml}
      </nav>
    </aside>
  `;

  // Control interactivo del menú móvil
  const btnMenu = document.getElementById("btnMenuMovil");
  const menuLateral = document.getElementById("menuLateral");

  if (btnMenu && menuLateral) {
    btnMenu.addEventListener("click", () => {
      const abierto = menuLateral.classList.toggle("abierto");
      btnMenu.setAttribute("aria-expanded", String(abierto));
    });

    // Cerrar menú al presionar fuera
    document.addEventListener("click", (e) => {
      if (
        menuLateral.classList.contains("abierto") &&
        !menuLateral.contains(e.target) &&
        e.target !== btnMenu
      ) {
        menuLateral.classList.remove("abierto");
        btnMenu.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Evento para el botón Salir
  const btnSalir = document.getElementById("btnCerrarSesion");
  if (btnSalir) {
    btnSalir.addEventListener("click", async () => {
      await cerrar();
    });
  }

  // Agregar pie de página al final del body si no existe
  if (!document.querySelector("footer.pie-app")) {
    const pie = document.createElement("footer");
    pie.className = "pie pie-app";
    pie.innerHTML = `<p>&copy; ${new Date().getFullYear()} ${NOMBRE} · Todos los derechos reservados.</p>`;
    document.body.appendChild(pie);
  }

  // Cargar número de noticias publicadas sin leer si hay sesión activa
  if (tieneSesion) {
    (async () => {
      try {
        const { listar } = await import("./api.js");
        const [noticias, lecturas] = await Promise.all([
          listar("noticias"),
          listar("lecturas-noticias")
        ]);
        const idsLeidas = new Set(lecturas.map((l) => l.noticiaId));
        const noLeidas = noticias.filter(
          (n) => n.estado === "publicado" && !idsLeidas.has(n.id)
        ).length;

        const badge = document.getElementById("badgeNoticiasMenu");
        if (badge && noLeidas > 0) {
          badge.textContent = String(noLeidas);
          badge.style.display = "inline-flex";
        }
      } catch {
        // Silencioso en caso de error de red o permisos
      }
    })();
  }
}
