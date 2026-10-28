// publico/js/modulos/noticias.js · Listado paginado de noticias con filtros y lecturas
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { usuarioActual } from "../nucleo/sesion.js";

await montarPlantilla({ titulo: "Noticias", roles: ["sesion"] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === "docente" || usuario.rol === "admin");

// Elementos DOM
const contenedorBotonNueva = document.getElementById("contenedorBotonNueva");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroTema = document.getElementById("filtroTema");
const gridNoticias = document.getElementById("gridNoticias");
const contenedorPaginacion = document.getElementById("contenedorPaginacion");
const btnPaginaAnterior = document.getElementById("btnPaginaAnterior");
const btnPaginaSiguiente = document.getElementById("btnPaginaSiguiente");
const indicadorPaginacion = document.getElementById("indicadorPaginacion");

if (esDocenteOAdmin && contenedorBotonNueva) {
  contenedorBotonNueva.style.display = "block";
}

const POR_PAGINA = 9;
let paginaActual = 1;

let todasNoticias = [];
let todosTemas = [];
let idsLeidas = new Set();

async function inicializar() {
  ui.cargando(true);
  try {
    const [noticiasData, temasData, lecturasData] = await Promise.all([
      api.listar("noticias"),
      api.listar("temas"),
      api.listar("lecturas-noticias")
    ]);

    todasNoticias = noticiasData;
    todosTemas = temasData;
    idsLeidas = new Set(lecturasData.map((l) => l.noticiaId));

    poblarFiltroTemas();
    renderizarListado();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar noticias", "error");
    gridNoticias.innerHTML = `<div class="tarjeta texto-centro" style="grid-column: 1 / -1;">No se pudieron cargar las noticias.</div>`;
  } finally {
    ui.cargando(false);
  }

  filtroCategoria.addEventListener("change", () => {
    paginaActual = 1;
    renderizarListado();
  });

  filtroTema.addEventListener("change", () => {
    paginaActual = 1;
    renderizarListado();
  });

  btnPaginaAnterior.addEventListener("click", () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizarListado();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  btnPaginaSiguiente.addEventListener("click", () => {
    const totalPaginas = obtenerTotalPaginas();
    if (paginaActual < totalPaginas) {
      paginaActual++;
      renderizarListado();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function poblarFiltroTemas() {
  filtroTema.innerHTML = '<option value="">Todos los temas</option>';
  for (const t of todosTemas) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.titulo || `Tema ${t.id}`;
    filtroTema.appendChild(opt);
  }
}

function obtenerNoticiasFiltradas() {
  const cat = filtroCategoria.value;
  const tema = filtroTema.value;

  let filtradas = todasNoticias.filter((n) => {
    if (cat && n.categoria !== cat) return false;
    if (tema && n.temaId !== tema) return false;
    return true;
  });

  // Ordenar: destacadas primero, luego por fecha más reciente
  filtradas.sort((a, b) => {
    const destA = a.destacada ? 1 : 0;
    const destB = b.destacada ? 1 : 0;
    if (destB !== destA) {
      return destB - destA;
    }
    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });

  return filtradas;
}

function obtenerTotalPaginas() {
  const filtradas = obtenerNoticiasFiltradas();
  return Math.ceil(filtradas.length / POR_PAGINA) || 1;
}

function renderizarListado() {
  const filtradas = obtenerNoticiasFiltradas();
  const total = filtradas.length;
  const totalPaginas = Math.ceil(total / POR_PAGINA) || 1;

  if (paginaActual > totalPaginas) {
    paginaActual = totalPaginas;
  }

  if (total === 0) {
    gridNoticias.innerHTML = `
      <div class="tarjeta texto-centro" style="grid-column: 1 / -1; padding: var(--espacio-xl) var(--espacio-m);">
        <p class="texto-m">No hay noticias que coincidan con los criterios seleccionados.</p>
      </div>
    `;
    contenedorPaginacion.style.display = "none";
    return;
  }

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const paginaElementos = filtradas.slice(inicio, inicio + POR_PAGINA);

  gridNoticias.innerHTML = paginaElementos
    .map((n) => {
      const leida = idsLeidas.has(n.id);
      const esNueva = !leida;
      const temaRel = todosTemas.find((t) => t.id === n.temaId);
      const fechaStr = n.fechaPublicacion || n.fecha;

      return `
        <article class="tarjeta tarjeta-noticia ${n.destacada ? "tarjeta-noticia--destacada" : ""}">
          ${
            n.imagen
              ? `
            <div class="tarjeta-noticia__portada">
              <img src="${ui.escapar(n.imagen)}" alt="${ui.escapar(n.titulo)}" class="tarjeta-noticia__imagen" loading="lazy">
            </div>
            `
              : ""
          }

          <div class="tarjeta-noticia__cuerpo">
            <div class="tarjeta-noticia__etiquetas">
              <span class="insignia insignia--secundario">${ui.escapar(n.categoria || "General")}</span>
              ${n.destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ""}
              ${esNueva ? '<span class="insignia insignia--exito">Nuevo</span>' : ""}
              ${n.estado === "borrador" ? '<span class="insignia insignia--advertencia">Borrador</span>' : ""}
              ${temaRel ? `<span class="insignia" style="background-color: var(--color-fondo); color: var(--color-texto); border: 1px solid var(--color-borde);">${ui.escapar(temaRel.titulo)}</span>` : ""}
            </div>

            <h2 class="tarjeta-noticia__titulo">
              <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}">
                ${ui.escapar(n.titulo || "Sin título")}
              </a>
            </h2>

            <p class="tarjeta-noticia__resumen">
              ${ui.escapar(n.resumen || "")}
            </p>
          </div>

          <footer class="tarjeta-noticia__pie">
            <span class="tarjeta-noticia__fecha">
              ${fechaStr ? util.fechaRelativa(fechaStr) : ""}
            </span>

            <div class="tarjeta-noticia__acciones">
              ${
                esDocenteOAdmin
                  ? `<a href="/paginas/editor-noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno">Editar</a>`
                  : ""
              }
              <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">
                Leer noticia →
              </a>
            </div>
          </footer>
        </article>
      `;
    })
    .join("");

  // Paginación
  if (totalPaginas > 1) {
    contenedorPaginacion.style.display = "flex";
    indicadorPaginacion.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    btnPaginaAnterior.disabled = paginaActual <= 1;
    btnPaginaSiguiente.disabled = paginaActual >= totalPaginas;
  } else {
    contenedorPaginacion.style.display = "none";
  }
}

await inicializar();
