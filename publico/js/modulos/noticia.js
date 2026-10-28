// publico/js/modulos/noticia.js · Visualización de noticia con registro automático de lectura
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { usuarioActual } from "../nucleo/sesion.js";

await montarPlantilla({ titulo: "Noticia", roles: ["sesion"] });

const noticiaId = util.parametro("id");
if (!noticiaId) {
  ui.aviso("No se especificó ninguna noticia", "error");
  setTimeout(() => (window.location.href = "/paginas/noticias.html"), 1500);
}

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === "docente" || usuario.rol === "admin");

// Elementos DOM
const migaTituloNoticia = document.getElementById("migaTituloNoticia");
const badgeCategoria = document.getElementById("badgeCategoria");
const badgeDestacada = document.getElementById("badgeDestacada");
const badgeBorrador = document.getElementById("badgeBorrador");
const fechaPublicacion = document.getElementById("fechaPublicacion");
const tituloNoticia = document.getElementById("tituloNoticia");
const autorNoticia = document.getElementById("autorNoticia");
const accionesAdmin = document.getElementById("accionesAdmin");
const btnEditarNoticia = document.getElementById("btnEditarNoticia");

const resumenNoticia = document.getElementById("resumenNoticia");
const contenedorImagenPortada = document.getElementById("contenedorImagenPortada");
const imgPortada = document.getElementById("imgPortada");
const cuerpoNoticia = document.getElementById("cuerpoNoticia");

const seccionTemaRelacionado = document.getElementById("seccionTemaRelacionado");
const tituloTemaRelacionado = document.getElementById("tituloTemaRelacionado");
const enlaceTemaRelacionado = document.getElementById("enlaceTemaRelacionado");

async function inicializar() {
  ui.cargando(true);
  try {
    const noticia = await api.obtener("noticias", noticiaId);

    // Registro automático de lectura si no existe previamente
    registrarLecturaSiNoExiste();

    // Migas y metadatos
    migaTituloNoticia.textContent = noticia.titulo || "Noticia";
    document.title = `${noticia.titulo || "Noticia"} · Ecosistema Educativo`;

    badgeCategoria.textContent = noticia.categoria || "General";
    if (noticia.destacada) badgeDestacada.style.display = "inline-flex";
    if (noticia.estado === "borrador") badgeBorrador.style.display = "inline-flex";

    const fechaStr = noticia.fechaPublicacion || noticia.fecha;
    if (fechaStr) {
      fechaPublicacion.textContent = `Publicado el ${util.fechaLarga(fechaStr)}`;
    }

    tituloNoticia.textContent = noticia.titulo || "Sin título";

    // Acciones de edición
    if (esDocenteOAdmin && btnEditarNoticia) {
      btnEditarNoticia.href = `/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}`;
      accionesAdmin.style.display = "block";
    }

    // Autor
    if (noticia.autorId) {
      try {
        const autor = await api.obtener("usuarios", noticia.autorId);
        autorNoticia.textContent = `Por ${autor.nombre || ""} ${autor.apellido || ""}`.trim();
      } catch {
        autorNoticia.textContent = "Comunicado oficial";
      }
    } else {
      autorNoticia.textContent = "Comunicado institucional";
    }

    // Resumen destacado
    if (noticia.resumen) {
      resumenNoticia.textContent = noticia.resumen;
    } else {
      resumenNoticia.style.display = "none";
    }

    // Imagen de portada
    if (noticia.imagen) {
      imgPortada.src = noticia.imagen;
      imgPortada.alt = noticia.titulo || "Portada de la noticia";
      contenedorImagenPortada.style.display = "block";
    }

    // Cuerpo formateado
    if (noticia.cuerpo) {
      cuerpoNoticia.innerHTML = util.formatoBasico(noticia.cuerpo);
    } else {
      cuerpoNoticia.innerHTML = `<p class="texto-suave">Sin contenido adicional.</p>`;
    }

    // Tema relacionado
    if (noticia.temaId) {
      try {
        const tema = await api.obtener("temas", noticia.temaId);
        if (tema) {
          tituloTemaRelacionado.textContent = tema.titulo || "Tema de estudio";
          enlaceTemaRelacionado.href = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;
          seccionTemaRelacionado.style.display = "block";
        }
      } catch {
        // Tema auxiliar no bloqueante
      }
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la noticia", "error");
    tituloNoticia.textContent = "Error al cargar la noticia";
  } finally {
    ui.cargando(false);
  }
}

async function registrarLecturaSiNoExiste() {
  try {
    const lecturas = await api.listar("lecturas-noticias");
    const yaLeida = lecturas.some((l) => l.noticiaId === noticiaId);
    if (!yaLeida) {
      await api.crear("lecturas-noticias", { noticiaId: noticiaId });
    }
  } catch {
    // Si ya existe o falla silently, no interrumpir la experiencia de lectura
  }
}

await inicializar();
