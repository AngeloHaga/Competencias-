// servidor/ganchos/noticias.js · Reglas de negocio y seguridad para la colección noticias
export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "estudiante") {
      return lista.filter((n) => n.estado === "publicado");
    }
    return lista;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!anterior) {
      // Al crear, fijar autorId al usuario autenticado
      datos.autorId = usuario?.id || null;
      if (datos.estado === "publicado" && !datos.fechaPublicacion) {
        datos.fechaPublicacion = new Date().toISOString();
      }
    } else {
      // Al actualizar, preservar autorId original
      datos.autorId = anterior.autorId;

      // Si pasa de borrador a publicado, fijar fecha de publicación
      if (anterior.estado !== "publicado" && datos.estado === "publicado") {
        datos.fechaPublicacion = new Date().toISOString();
      } else if (anterior.fechaPublicacion && !datos.fechaPublicacion) {
        datos.fechaPublicacion = anterior.fechaPublicacion;
      }
    }

    return datos;
  }
};
