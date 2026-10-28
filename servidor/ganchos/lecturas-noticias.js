// servidor/ganchos/lecturas-noticias.js · Reglas de negocio para registro de lecturas
import * as almacen from "../almacen.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;
    return lista.filter((l) => l.usuarioId === usuario.id);
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error("Se requiere iniciar sesión");
      err.estado = 401;
      throw err;
    }

    datos.usuarioId = usuario.id;

    if (!datos.noticiaId) {
      const err = new Error("El campo noticiaId es obligatorio");
      err.estado = 400;
      throw err;
    }

    const existentes = await almacen.leer("lecturas-noticias");
    const esDuplicado = existentes.some(
      (l) =>
        l.usuarioId === usuario.id &&
        l.noticiaId === datos.noticiaId &&
        (!anterior || l.id !== anterior.id)
    );

    if (esDuplicado) {
      const err = new Error("La lectura de esta noticia ya se encuentra registrada");
      err.estado = 400;
      throw err;
    }

    return datos;
  }
};
