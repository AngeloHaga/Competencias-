// servidor/ganchos/distributivo.js · Reglas de seguridad para la colección distributivo
import * as acceso from "../acceso.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    return await acceso.gruposDe(usuario);
  }
};
