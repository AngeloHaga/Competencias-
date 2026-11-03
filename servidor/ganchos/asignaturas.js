// servidor/ganchos/asignaturas.js · Reglas de seguridad para la colección asignaturas
import * as acceso from "../acceso.js";
import * as almacen from "../almacen.js";

export default {
  async filtrarLista(lista, usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return lista;

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const ids = new Set(misAsignaturas.map((a) => a.id));
    return lista.filter((a) => ids.has(a.id));
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error("Se requiere iniciar sesión");
      err.estado = 401;
      throw err;
    }

    if (anterior && usuario.rol === "docente") {
      const puede = await acceso.puedeEditarAsignatura(usuario, anterior.id);
      if (!puede) {
        const err = new Error("No tienes permiso para modificar esta asignatura");
        err.estado = 403;
        throw err;
      }
    }

    const nombre = String(datos.nombre || "").trim();
    if (!nombre) {
      const err = new Error("El nombre de la asignatura es obligatorio");
      err.estado = 400;
      throw err;
    }

    const nivel = String(datos.nivel || "").trim();
    if (!nivel) {
      const err = new Error("El nivel académico de la asignatura es obligatorio");
      err.estado = 400;
      throw err;
    }

    return {
      ...datos,
      nombre,
      nivel
    };
  },

  async despuesDeGuardar(nuevo, usuario, anterior) {
    // Si fue creada por un docente, vincular automáticamente en el distributivo académico
    if (!anterior && usuario && usuario.rol === "docente") {
      const distributivo = await almacen.leer("distributivo");
      const yaExiste = distributivo.some(
        (d) => d.asignaturaId === nuevo.id && d.docenteId === usuario.id
      );
      if (!yaExiste) {
        await almacen.agregar("distributivo", {
          asignaturaId: nuevo.id,
          docenteId: usuario.id,
          paralelo: "A",
          periodo: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          estudiantes: []
        });
      }
    }
    return nuevo;
  }
};

