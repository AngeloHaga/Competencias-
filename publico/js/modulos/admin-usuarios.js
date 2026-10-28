// publico/js/modulos/admin-usuarios.js · Gestión de usuarios, roles, estado y reseteo de claves
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Usuarios", roles: ["admin"] });

const inputBuscar = document.getElementById("inputBuscar");
const filtroRol = document.getElementById("filtroRol");
const cuerpoTabla = document.getElementById("cuerpoTablaUsuarios");
const conteoUsuarios = document.getElementById("conteoUsuarios");

let todosLosUsuarios = [];

async function cargarUsuarios() {
  ui.cargando(true);
  try {
    todosLosUsuarios = await api.listar("usuarios");
    renderizarTabla();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la lista de usuarios", "error");
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="5" class="texto-centro">No se pudieron cargar los usuarios.</td>
      </tr>
    `;
  } finally {
    ui.cargando(false);
  }
}

function filtrarUsuarios() {
  const termino = (inputBuscar.value || "").trim().toLowerCase();
  const rolSeleccionado = filtroRol.value;

  return todosLosUsuarios.filter((u) => {
    const coincideRol = !rolSeleccionado || u.rol === rolSeleccionado;
    if (!coincideRol) return false;

    if (!termino) return true;

    const nombre = (u.nombre || "").toLowerCase();
    const apellido = (u.apellido || "").toLowerCase();
    const correo = (u.correo || "").toLowerCase();
    const nombreCompleto = `${nombre} ${apellido}`;

    return (
      nombre.includes(termino) ||
      apellido.includes(termino) ||
      correo.includes(termino) ||
      nombreCompleto.includes(termino)
    );
  });
}

function renderizarTabla() {
  const filtrados = filtrarUsuarios();
  conteoUsuarios.textContent = `${filtrados.length} ${filtrados.length === 1 ? "usuario" : "usuarios"}`;

  if (filtrados.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="5" class="texto-centro">No se encontraron usuarios coincidentes.</td>
      </tr>
    `;
    return;
  }

  cuerpoTabla.innerHTML = filtrados.map((u) => {
    const inicial = (u.nombre || "U").trim().charAt(0).toUpperCase();
    const avatarHtml = u.foto
      ? `<img src="${ui.escapar(u.foto)}" alt="Foto de ${ui.escapar(u.nombre)}">`
      : `<span>${ui.escapar(inicial)}</span>`;

    const esActivo = u.activo !== false;

    return `
      <tr data-id="${ui.escapar(u.id)}">
        <td>
          <div class="usuario-celda">
            <div class="usuario-miniatura">${avatarHtml}</div>
            <span class="usuario-nombre">${ui.escapar(u.nombre || "")} ${ui.escapar(u.apellido || "")}</span>
          </div>
        </td>
        <td>${ui.escapar(u.correo || "")}</td>
        <td>
          <select class="select-rol" data-id="${ui.escapar(u.id)}" data-actual="${ui.escapar(u.rol || "estudiante")}" aria-label="Rol de ${ui.escapar(u.nombre)}">
            <option value="estudiante" ${u.rol === "estudiante" ? "selected" : ""}>Estudiante</option>
            <option value="docente" ${u.rol === "docente" ? "selected" : ""}>Docente</option>
            <option value="admin" ${u.rol === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </td>
        <td>
          <label class="etiqueta-activo">
            <input type="checkbox" class="check-activo" data-id="${ui.escapar(u.id)}" ${esActivo ? "checked" : ""}>
            <span>${esActivo ? "Activo" : "Inactivo"}</span>
          </label>
        </td>
        <td class="texto-derecha">
          <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer" data-id="${ui.escapar(u.id)}" data-nombre="${ui.escapar(u.nombre || "")}" data-correo="${ui.escapar(u.correo || "")}">
            Restablecer clave
          </button>
        </td>
      </tr>
    `;
  }).join("");

  asignarEventosTabla();
}

function asignarEventosTabla() {
  // Cambio de rol
  cuerpoTabla.querySelectorAll(".select-rol").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-id");
      const nuevoRol = sel.value;
      const rolAnterior = sel.getAttribute("data-actual");

      try {
        await api.actualizar("usuarios", id, { rol: nuevoRol });
        sel.setAttribute("data-actual", nuevoRol);
        const usuarioEnMemoria = todosLosUsuarios.find((u) => u.id === id);
        if (usuarioEnMemoria) usuarioEnMemoria.rol = nuevoRol;
        ui.aviso("Rol de usuario actualizado", "exito");
      } catch (err) {
        sel.value = rolAnterior;
        ui.aviso(err.message || "Error al actualizar el rol", "error");
      }
    });
  });

  // Cambio de estado activo
  cuerpoTabla.querySelectorAll(".check-activo").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const id = chk.getAttribute("data-id");
      const nuevoEstado = chk.checked;
      const etiquetaSpan = chk.nextElementSibling;

      try {
        await api.actualizar("usuarios", id, { activo: nuevoEstado });
        if (etiquetaSpan) etiquetaSpan.textContent = nuevoEstado ? "Activo" : "Inactivo";
        const usuarioEnMemoria = todosLosUsuarios.find((u) => u.id === id);
        if (usuarioEnMemoria) usuarioEnMemoria.activo = nuevoEstado;
        ui.aviso(`Usuario marcado como ${nuevoEstado ? "activo" : "inactivo"}`, "exito");
      } catch (err) {
        chk.checked = !nuevoEstado;
        if (etiquetaSpan) etiquetaSpan.textContent = !nuevoEstado ? "Activo" : "Inactivo";
        ui.aviso(err.message || "Error al actualizar el estado", "error");
      }
    });
  });

  // Restablecer clave
  cuerpoTabla.querySelectorAll(".btn-restablecer").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const nombre = btn.getAttribute("data-nombre");
      const correo = btn.getAttribute("data-correo");

      const confirmado = await ui.confirmar(
        `¿Deseas restablecer la contraseña de ${nombre || correo}? Se generará una clave temporal.`
      );
      if (!confirmado) return;

      ui.cargando(true);
      try {
        const resp = await api.llamar("POST", `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
        const claveTemporal = resp && resp.claveTemporal;

        // Modal accesible con clave temporal y botón copiar
        const contenidoModal = document.createElement("div");
        contenidoModal.className = "pila";
        contenidoModal.innerHTML = `
          <p>Se ha generado una clave temporal para <strong>${ui.escapar(correo)}</strong>:</p>
          <div class="clave-temporal-caja">
            <code class="clave-temporal-codigo" id="codigoClave">${ui.escapar(claveTemporal)}</code>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnCopiarClave">
              Copiar
            </button>
          </div>
          <p class="texto-ayuda">El usuario deberá ingresar con esta clave temporal y cambiarla desde su perfil.</p>
        `;

        const btnCopiar = contenidoModal.querySelector("#btnCopiarClave");
        btnCopiar.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(claveTemporal);
            btnCopiar.textContent = "¡Copiada!";
            setTimeout(() => {
              btnCopiar.textContent = "Copiar";
            }, 2000);
          } catch {
            ui.aviso("No se pudo copiar automáticamente. Cópiala manualmente.", "advertencia");
          }
        });

        await ui.modal({
          titulo: "Clave temporal generada",
          contenido: contenidoModal,
          acciones: [{ texto: "Aceptar", valor: true, tipo: "primario" }]
        });
      } catch (err) {
        ui.aviso(err.message || "Error al restablecer la contraseña", "error");
      } finally {
        ui.cargando(false);
      }
    });
  });
}

// Filtros en vivo
inputBuscar.addEventListener("input", renderizarTabla);
filtroRol.addEventListener("change", renderizarTabla);

// Carga inicial
await cargarUsuarios();
