// publico/js/modulos/inicio.js · Lógica de la página de inicio
import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual, token } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { calcularAvance } from "./asignaturas.js";

await montarPlantilla({ titulo: "Inicio", roles: ["publico"] });

const usuario = usuarioActual();
const tieneSesion = Boolean(usuario && token());
const contenido = document.getElementById("contenido");

if (!contenido) {
  // Nada que renderizar si no existe el contenedor principal
} else if (!tieneSesion) {
  renderizarSinSesion();
} else {
  await renderizarConSesion();
}

/**
 * Renderiza la vista de inicio para usuarios sin sesión
 */
function renderizarSinSesion() {
  contenido.innerHTML = `
    <div class="inicio-layout">
      <section class="inicio-hero" aria-label="Presentación institucional">
        <span class="inicio-hero__institucion">Universidad Estatal de Milagro</span>
        <h1 class="inicio-hero__titulo">Ecosistema Educativo Digital</h1>
        <p class="inicio-hero__descripcion">
          Plataforma web para el desarrollo y fortalecimiento de competencias académicas: contenidos curriculares dinámicos, actividades lúdicas con retroalimentación, gamificación y tutoría inteligente.
        </p>
        <div class="inicio-hero__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--primario">Ingresar al sistema</a>
          <a href="/paginas/registro.html" class="btn btn--acento">Registrarse</a>
        </div>
      </section>

      <div class="grid-auto">
        <article class="tarjeta">
          <h2 class="tarjeta__titulo">Contenidos Curriculares</h2>
          <p class="tarjeta__cuerpo" style="margin-top: var(--espacio-s);">
            Aprende a tu propio ritmo con asignaturas estructuradas por unidades y temas, enriquecidos con recursos multimedia y canciones educativas.
          </p>
        </article>

        <article class="tarjeta">
          <h2 class="tarjeta__titulo">Gamificación y Logros</h2>
          <p class="tarjeta__cuerpo" style="margin-top: var(--espacio-s);">
            Refuerza tus conocimientos resolviendo actividades interactivas, acumula puntos de experiencia, desbloquea insignias y obtén diplomas de mérito.
          </p>
        </article>

        <article class="tarjeta">
          <h2 class="tarjeta__titulo">Tutoría con IA</h2>
          <p class="tarjeta__cuerpo" style="margin-top: var(--espacio-s);">
            Apoyo pedagógico socrático personalizado que te guía paso a paso mediante preguntas orientadoras y explicaciones claras.
          </p>
        </article>
      </div>
    </div>
  `;
}

/**
 * Renderiza la vista de inicio para usuarios autenticados
 */
async function renderizarConSesion() {
  const rolTexto = {
    estudiante: "Estudiante",
    docente: "Docente",
    admin: "Administrador del Sistema"
  }[usuario.rol] || usuario.rol;

  // 1. Verificar último tema visitado en localStorage
  let bloqueContinuar = "";
  try {
    const rawUltimo = localStorage.getItem("ultimoTema");
    if (rawUltimo) {
      const ultimo = JSON.parse(rawUltimo);
      if (ultimo && ultimo.id && ultimo.titulo) {
        bloqueContinuar = `
          <section class="tarjeta-continuar" aria-label="Continuar aprendizaje">
            <div class="tarjeta-continuar__info">
              <span class="tarjeta-continuar__sub">Continuar donde te quedaste</span>
              <h2 class="tarjeta-continuar__titulo">${ui.escapar(ultimo.titulo)}</h2>
            </div>
            <a href="/paginas/tema.html?id=${encodeURIComponent(ultimo.id)}" class="btn btn--acento">
              Continuar tema →
            </a>
          </section>
        `;
      }
    }
  } catch {
    // Si el parseo falla, se omite el bloque
  }

  // 2. Accesos rápidos para docentes y admin
  let bloqueGestion = "";
  if (usuario.rol === "docente" || usuario.rol === "admin") {
    bloqueGestion = `
      <section class="seccion-gestion" aria-label="Accesos rápidos de gestión">
        <h2 class="inicio-seccion__titulo">Accesos rápidos</h2>
        <div class="gestion-grid">
          <a href="/paginas/editor-contenidos.html" class="tarjeta-gestion">
            <span class="tarjeta-gestion__icono" aria-hidden="true">📚</span>
            <div>
              <h3 class="tarjeta-gestion__titulo">Contenidos</h3>
              <p class="tarjeta-gestion__desc">Gestiona unidades, temas y fichas curriculares</p>
            </div>
          </a>
          <a href="/paginas/noticias.html" class="tarjeta-gestion">
            <span class="tarjeta-gestion__icono" aria-hidden="true">📢</span>
            <div>
              <h3 class="tarjeta-gestion__titulo">Noticias</h3>
              <p class="tarjeta-gestion__desc">Publica y consulta novedades institucionales</p>
            </div>
          </a>
          ${
            usuario.rol === "admin"
              ? `
            <a href="/paginas/admin-asignaturas.html" class="tarjeta-gestion">
              <span class="tarjeta-gestion__icono" aria-hidden="true">🏛️</span>
              <div>
                <h3 class="tarjeta-gestion__titulo">Asignaturas</h3>
                <p class="tarjeta-gestion__desc">Cursos, mallas curriculares y niveles</p>
              </div>
            </a>
            <a href="/paginas/distributivo.html" class="tarjeta-gestion">
              <span class="tarjeta-gestion__icono" aria-hidden="true">📋</span>
              <div>
                <h3 class="tarjeta-gestion__titulo">Distributivo</h3>
                <p class="tarjeta-gestion__desc">Asignación de paralelos y estudiantes</p>
              </div>
            </a>
          `
              : ""
          }
        </div>
      </section>
    `;
  }

  // 3. Estructura general de la página mientras cargan los datos dinámicos
  contenido.innerHTML = `
    <div class="inicio-layout">
      <header class="inicio-saludo">
        <div class="inicio-saludo__texto">
          <h1>¡Hola, ${ui.escapar(usuario.nombre)}!</h1>
          <p>Bienvenido al Ecosistema Educativo · Rol: <strong>${ui.escapar(rolTexto)}</strong></p>
        </div>
      </header>

      ${bloqueContinuar}
      ${bloqueGestion}

      <section class="inicio-seccion" aria-label="Mis asignaturas">
        <div class="inicio-seccion__cabecera">
          <h2 class="inicio-seccion__titulo">Mis asignaturas</h2>
          <a href="/paginas/asignaturas.html" class="btn btn--texto">Ver todas →</a>
        </div>
        <div id="contenedor-asignaturas" class="grid-asignaturas">
          <p class="texto-suave">Cargando asignaturas...</p>
        </div>
      </section>

      <section class="inicio-seccion" aria-label="Últimas noticias">
        <div class="inicio-seccion__cabecera">
          <h2 class="inicio-seccion__titulo">Noticias recientes</h2>
          <a href="/paginas/noticias.html" class="btn btn--texto">Ver todas →</a>
        </div>
        <div id="contenedor-noticias" class="grid-noticias">
          <p class="texto-suave">Cargando noticias...</p>
        </div>
      </section>
    </div>
  `;

  // 4. Cargar y renderizar mis asignaturas con su avance
  const contenedorAsignaturas = document.getElementById("contenedor-asignaturas");
  try {
    const asignaturas = await api.listar("asignaturas");

    if (!asignaturas || asignaturas.length === 0) {
      contenedorAsignaturas.innerHTML = `
        <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
          <p class="texto-suave">No tienes asignaturas asignadas actualmente.</p>
        </div>
      `;
    } else {
      const cardsHtml = await Promise.all(
        asignaturas.map(async (asig) => {
          const avance = await calcularAvance(asig.id);
          const porcentaje = avance.porcentaje || 0;
          const revisados = avance.revisados || 0;
          const total = avance.total || 0;

          return `
            <article class="tarjeta tarjeta-asig">
              <div>
                <div class="tarjeta-asig__header">
                  <h3 class="tarjeta__titulo" style="font-size: var(--tamano-m);">${ui.escapar(asig.nombre)}</h3>
                  <span class="insignia insignia--secundario">${ui.escapar(asig.nivel || "Nivel")}</span>
                </div>
                <p class="tarjeta__cuerpo" style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
                  ${ui.escapar(asig.descripcion || "Sin descripción disponible.")}
                </p>
              </div>

              <div class="tarjeta-asig__progreso">
                <div class="tarjeta-asig__meta">
                  <span>Progreso de temas</span>
                  <strong>${porcentaje}% (${revisados}/${total})</strong>
                </div>
                <div class="progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso en ${ui.escapar(asig.nombre)}">
                  <span style="width: ${porcentaje}%;"></span>
                </div>
                <div style="margin-top: var(--espacio-s);">
                  <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--secundario btn--pequeno" style="width: 100%;">
                    Ver asignatura →
                  </a>
                </div>
              </div>
            </article>
          `;
        })
      );
      contenedorAsignaturas.innerHTML = cardsHtml.join("");
    }
  } catch (err) {
    contenedorAsignaturas.innerHTML = `
      <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
        <p class="texto-suave">No se pudieron cargar tus asignaturas.</p>
      </div>
    `;
  }

  // 5. Cargar las 3 noticias publicadas más recientes (destacadas primero)
  const contenedorNoticias = document.getElementById("contenedor-noticias");
  try {
    const [noticias, lecturas] = await Promise.all([
      api.listar("noticias").catch(() => []),
      api.listar("lecturas-noticias").catch(() => [])
    ]);

    const idsLeidas = new Set(lecturas.map((l) => l.noticiaId));
    const publicadas = (noticias || []).filter((n) => n.estado === "publicado");

    // Ordenar: destacadas primero, luego por fecha más reciente
    publicadas.sort((a, b) => {
      const destA = a.destacada ? 1 : 0;
      const destB = b.destacada ? 1 : 0;
      if (destA !== destB) {
        return destB - destA;
      }
      const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fechaB - fechaA;
    });

    const recientes = publicadas.slice(0, 3);

    if (recientes.length === 0) {
      contenedorNoticias.innerHTML = `
        <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
          <p class="texto-suave">No hay noticias publicadas en este momento.</p>
        </div>
      `;
    } else {
      contenedorNoticias.innerHTML = recientes
        .map((noticia) => {
          const noLeida = !idsLeidas.has(noticia.id);
          const fechaStr = util.fechaRelativa(noticia.fechaPublicacion || noticia.fecha);

          return `
            <article class="tarjeta tarjeta-noticia">
              <div>
                <div class="tarjeta-noticia__badges">
                  ${noticia.destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ""}
                  ${noLeida ? '<span class="insignia insignia--exito">Nuevo</span>' : ""}
                  <span class="insignia insignia--secundario">${ui.escapar(noticia.categoria || "General")}</span>
                </div>
                <h3 class="tarjeta__titulo" style="font-size: var(--tamano-m);">
                  ${ui.escapar(noticia.titulo)}
                </h3>
                <p class="tarjeta__cuerpo" style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin-top: var(--espacio-xs);">
                  ${ui.escapar(noticia.resumen || "")}
                </p>
              </div>

              <div>
                <p class="tarjeta-noticia__fecha">Publicado: ${ui.escapar(fechaStr)}</p>
                <div style="margin-top: var(--espacio-s);">
                  <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--secundario btn--pequeno" style="width: 100%;">
                    Leer noticia →
                  </a>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    }
  } catch (err) {
    contenedorNoticias.innerHTML = `
      <div class="tarjeta texto-centro" style="grid-column: 1 / -1;">
        <p class="texto-suave">No se pudieron cargar las noticias.</p>
      </div>
    `;
  }
}
