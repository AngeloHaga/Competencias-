// publico/js/modulos/perfil.js · Lógica de perfil, actualización de datos, avatar y contraseña
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as sesion from "../nucleo/sesion.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Mi Perfil", roles: ["sesion"] });

// Referencias del DOM - Perfil
const formPerfil = document.getElementById("formPerfil");
const inputNombre = document.getElementById("nombre");
const inputApellido = document.getElementById("apellido");
const inputCorreo = document.getElementById("correo");
const badgeRol = document.getElementById("badgeRol");
const imgAvatar = document.getElementById("imgAvatar");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");
const inputFoto = document.getElementById("inputFoto");
const errorFoto = document.getElementById("errorFoto");
const errorNombre = document.getElementById("errorNombre");
const errorApellido = document.getElementById("errorApellido");
const grupoNombre = document.getElementById("grupoNombre");
const grupoApellido = document.getElementById("grupoApellido");
const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");

// Referencias del DOM - Contraseña
const formClave = document.getElementById("formClave");
const inputClaveActual = document.getElementById("claveActual");
const inputClaveNueva = document.getElementById("claveNueva");
const inputClaveRepetir = document.getElementById("claveRepetir");
const errorClaveActual = document.getElementById("errorClaveActual");
const errorClaveNueva = document.getElementById("errorClaveNueva");
const errorClaveRepetir = document.getElementById("errorClaveRepetir");
const grupoClaveActual = document.getElementById("grupoClaveActual");
const grupoClaveNueva = document.getElementById("grupoClaveNueva");
const grupoClaveRepetir = document.getElementById("grupoClaveRepetir");
const btnCambiarClave = document.getElementById("btnCambiarClave");

let fotoActualUrl = null;
let archivoFotoSeleccionado = null;

function establecerError(grupo, elementoError, input, mensaje) {
  if (grupo) grupo.classList.add("campo--error");
  if (elementoError) elementoError.textContent = mensaje;
  if (input) input.setAttribute("aria-invalid", "true");
}

function limpiarError(grupo, elementoError, input) {
  if (grupo) grupo.classList.remove("campo--error");
  if (elementoError) elementoError.textContent = "";
  if (input) input.removeAttribute("aria-invalid");
}

function actualizarVistaAvatar(url, nombre = "") {
  if (url) {
    imgAvatar.src = url;
    imgAvatar.classList.add("perfil-avatar--visible");
    avatarPlaceholder.style.display = "none";
  } else {
    imgAvatar.src = "";
    imgAvatar.classList.remove("perfil-avatar--visible");
    avatarPlaceholder.style.display = "block";
    const inicial = (nombre || "U").trim().charAt(0).toUpperCase();
    avatarPlaceholder.textContent = inicial;
  }
}

// Cargar datos actuales del usuario
async function cargarDatosUsuario() {
  ui.cargando(true);
  try {
    let usuario = null;
    try {
      usuario = await api.llamar("GET", "/api/auth/yo");
    } catch {
      usuario = sesion.usuarioActual();
    }

    if (!usuario) return;

    inputNombre.value = usuario.nombre || "";
    inputApellido.value = usuario.apellido || "";
    inputCorreo.value = usuario.correo || "";
    badgeRol.textContent = usuario.rol || "";
    fotoActualUrl = usuario.foto || null;

    actualizarVistaAvatar(fotoActualUrl, usuario.nombre);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos del perfil", "error");
  } finally {
    ui.cargando(false);
  }
}

await cargarDatosUsuario();

// Previsualización de foto seleccionada
inputFoto.addEventListener("change", () => {
  limpiarError(null, errorFoto, inputFoto);
  const archivo = inputFoto.files && inputFoto.files[0];

  if (!archivo) {
    archivoFotoSeleccionado = null;
    return;
  }

  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
  if (!tiposPermitidos.includes(archivo.type)) {
    establecerError(null, errorFoto, inputFoto, "Formato no válido. Usa JPG, PNG o WEBP.");
    inputFoto.value = "";
    archivoFotoSeleccionado = null;
    return;
  }

  if (archivo.size > 2 * 1024 * 1024) {
    establecerError(null, errorFoto, inputFoto, "La imagen supera los 2 MB permitidos.");
    inputFoto.value = "";
    archivoFotoSeleccionado = null;
    return;
  }

  archivoFotoSeleccionado = archivo;
  const urlTemporal = URL.createObjectURL(archivo);
  actualizarVistaAvatar(urlTemporal, inputNombre.value);
});

// Guardar cambios en el perfil
formPerfil.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = inputNombre.value.trim();
  const apellido = inputApellido.value.trim();

  let hayError = false;
  if (!nombre) {
    establecerError(grupoNombre, errorNombre, inputNombre, "El nombre es obligatorio");
    hayError = true;
  } else {
    limpiarError(grupoNombre, errorNombre, inputNombre);
  }

  if (!apellido) {
    establecerError(grupoApellido, errorApellido, inputApellido, "El apellido es obligatorio");
    hayError = true;
  } else {
    limpiarError(grupoApellido, errorApellido, inputApellido);
  }

  if (hayError) return;

  btnGuardarPerfil.disabled = true;
  const textoOriginal = btnGuardarPerfil.textContent;
  btnGuardarPerfil.textContent = "Guardando...";
  ui.cargando(true);

  try {
    let urlFoto = fotoActualUrl;

    // Si seleccionó una nueva foto, subirla primero
    if (archivoFotoSeleccionado) {
      const respSubida = await api.subir(archivoFotoSeleccionado);
      if (respSubida && respSubida.url) {
        urlFoto = respSubida.url;
        fotoActualUrl = urlFoto;
      }
    }

    // Actualizar perfil mediante PUT /api/auth/perfil
    const actualizado = await api.llamar("PUT", "/api/auth/perfil", {
      nombre,
      apellido,
      foto: urlFoto
    });

    // Sincronizar sessionStorage
    const usuarioSesion = sesion.usuarioActual() || {};
    usuarioSesion.nombre = actualizado.nombre;
    usuarioSesion.apellido = actualizado.apellido;
    usuarioSesion.foto = actualizado.foto;
    sessionStorage.setItem("usuario", JSON.stringify(usuarioSesion));

    // Actualizar nombre visible en el encabezado
    const elemEncabezado = document.querySelector(".encabezado-app__nombre-usuario");
    if (elemEncabezado) {
      elemEncabezado.textContent = `${actualizado.nombre} ${actualizado.apellido}`.trim();
    }

    archivoFotoSeleccionado = null;
    inputFoto.value = "";
    actualizarVistaAvatar(urlFoto, actualizado.nombre);
    ui.aviso("Perfil actualizado correctamente", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar el perfil", "error");
  } finally {
    btnGuardarPerfil.disabled = false;
    btnGuardarPerfil.textContent = textoOriginal;
    ui.cargando(false);
  }
});

// Cambio de contraseña con POST /api/auth/clave
formClave.addEventListener("submit", async (e) => {
  e.preventDefault();

  const actual = inputClaveActual.value;
  const nueva = inputClaveNueva.value;
  const repetir = inputClaveRepetir.value;

  let hayError = false;

  if (!actual) {
    establecerError(grupoClaveActual, errorClaveActual, inputClaveActual, "Ingresa tu contraseña actual");
    hayError = true;
  } else {
    limpiarError(grupoClaveActual, errorClaveActual, inputClaveActual);
  }

  if (!nueva || nueva.length < 8 || !/[a-zA-Z]/.test(nueva) || !/\d/.test(nueva)) {
    establecerError(
      grupoClaveNueva,
      errorClaveNueva,
      inputClaveNueva,
      "Debe tener al menos 8 caracteres y contener letras y números"
    );
    hayError = true;
  } else {
    limpiarError(grupoClaveNueva, errorClaveNueva, inputClaveNueva);
  }

  if (!repetir || repetir !== nueva) {
    establecerError(grupoClaveRepetir, errorClaveRepetir, inputClaveRepetir, "Las contraseñas no coinciden");
    hayError = true;
  } else {
    limpiarError(grupoClaveRepetir, errorClaveRepetir, inputClaveRepetir);
  }

  if (hayError) return;

  btnCambiarClave.disabled = true;
  const textoOriginal = btnCambiarClave.textContent;
  btnCambiarClave.textContent = "Cambiando...";
  ui.cargando(true);

  try {
    await api.llamar("POST", "/api/auth/clave", { actual, nueva });
    ui.aviso("Contraseña actualizada con éxito", "exito");
    formClave.reset();
  } catch (err) {
    ui.aviso(err.message || "Error al cambiar la contraseña", "error");
  } finally {
    btnCambiarClave.disabled = false;
    btnCambiarClave.textContent = textoOriginal;
    ui.cargando(false);
  }
});
