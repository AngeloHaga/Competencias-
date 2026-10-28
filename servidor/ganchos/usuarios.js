// servidor/ganchos/usuarios.js · Reglas de seguridad para la colección usuarios
export default {
  // Quita claveHash de las listas obtenidas
  async filtrarLista(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.map(({ claveHash, ...resto }) => resto);
  },

  // Ignora claveHash y correo, y evita que un admin se quite el rol o se desactive a sí mismo
  async antesDeGuardar(datos, usuario, anterior) {
    const { claveHash, correo, ...limpios } = datos || {};

    if (anterior && usuario) {
      if (usuario.rol === "admin" && String(anterior.id) === String(usuario.id)) {
        if (limpios.rol !== undefined && limpios.rol !== "admin") {
          const err = new Error("Un administrador no puede quitarse el rol a sí mismo");
          err.estado = 400;
          throw err;
        }

        if (limpios.activo === false) {
          const err = new Error("Un administrador no puede desactivar su propia cuenta");
          err.estado = 400;
          throw err;
        }
      }
    }

    return limpios;
  }
};
