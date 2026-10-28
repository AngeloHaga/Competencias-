// publico/js/modulos/registro.js · Lógica de registro de usuario con validación en vivo
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as sesion from "../nucleo/sesion.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Registro de usuario", roles: ["publico"] });

// Si ya existe sesión activa, redirigir al inicio
if (sesion.usuarioActual() && sesion.token()) {
  window.location.href = "/index.html";
}

const form = document.getElementById("formRegistro");
const inputNombre = document.getElementById("nombre");
const inputApellido = document.getElementById("apellido");
const inputCorreo = document.getElementById("correo");
const inputClave = document.getElementById("clave");
const inputClaveConfirmar = document.getElementById("claveConfirmar");
const checkConsentimiento = document.getElementById("consentimiento");

const errorNombre = document.getElementById("errorNombre");
const errorApellido = document.getElementById("errorApellido");
const errorCorreo = document.getElementById("errorCorreo");
const errorClave = document.getElementById("errorClave");
const errorClaveConfirmar = document.getElementById("errorClaveConfirmar");
const errorConsentimiento = document.getElementById("errorConsentimiento");

const grupoNombre = document.getElementById("grupoNombre");
const grupoApellido = document.getElementById("grupoApellido");
const grupoCorreo = document.getElementById("grupoCorreo");
const grupoClave = document.getElementById("grupoClave");
const grupoClaveConfirmar = document.getElementById("grupoClaveConfirmar");
const grupoConsentimiento = document.getElementById("grupoConsentimiento");

const btnRegistro = document.getElementById("btnRegistro");

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function establecerError(grupo, elementoError, input, mensaje) {
  grupo.classList.add("campo--error");
  elementoError.textContent = mensaje;
  input.setAttribute("aria-invalid", "true");
}

function limpiarError(grupo, elementoError, input) {
  grupo.classList.remove("campo--error");
  elementoError.textContent = "";
  input.removeAttribute("aria-invalid");
}

function validarNombre() {
  const valor = inputNombre.value.trim();
  if (!valor) {
    establecerError(grupoNombre, errorNombre, inputNombre, "El nombre es obligatorio");
    return false;
  }
  if (valor.length < 2) {
    establecerError(grupoNombre, errorNombre, inputNombre, "El nombre debe tener al menos 2 caracteres");
    return false;
  }
  limpiarError(grupoNombre, errorNombre, inputNombre);
  return true;
}

function validarApellido() {
  const valor = inputApellido.value.trim();
  if (!valor) {
    establecerError(grupoApellido, errorApellido, inputApellido, "El apellido es obligatorio");
    return false;
  }
  if (valor.length < 2) {
    establecerError(grupoApellido, errorApellido, inputApellido, "El apellido debe tener al menos 2 caracteres");
    return false;
  }
  limpiarError(grupoApellido, errorApellido, inputApellido);
  return true;
}

function validarCorreo() {
  const valor = inputCorreo.value.trim();
  if (!valor) {
    establecerError(grupoCorreo, errorCorreo, inputCorreo, "El correo electrónico es obligatorio");
    return false;
  }
  if (!REGEX_CORREO.test(valor)) {
    establecerError(grupoCorreo, errorCorreo, inputCorreo, "Ingresa un correo electrónico válido");
    return false;
  }
  limpiarError(grupoCorreo, errorCorreo, inputCorreo);
  return true;
}

function validarClave() {
  const valor = inputClave.value;
  if (!valor) {
    establecerError(grupoClave, errorClave, inputClave, "La contraseña es obligatoria");
    return false;
  }
  if (valor.length < 8) {
    establecerError(grupoClave, errorClave, inputClave, "La contraseña debe tener al menos 8 caracteres");
    return false;
  }
  if (!/[a-zA-Z]/.test(valor) || !/\d/.test(valor)) {
    establecerError(grupoClave, errorClave, inputClave, "La contraseña debe incluir tanto letras como números");
    return false;
  }
  limpiarError(grupoClave, errorClave, inputClave);
  return true;
}

function validarClaveConfirmar() {
  const valor = inputClaveConfirmar.value;
  if (!valor) {
    establecerError(grupoClaveConfirmar, errorClaveConfirmar, inputClaveConfirmar, "Confirma tu contraseña");
    return false;
  }
  if (valor !== inputClave.value) {
    establecerError(grupoClaveConfirmar, errorClaveConfirmar, inputClaveConfirmar, "Las contraseñas no coinciden");
    return false;
  }
  limpiarError(grupoClaveConfirmar, errorClaveConfirmar, inputClaveConfirmar);
  return true;
}

function validarConsentimiento() {
  if (!checkConsentimiento.checked) {
    establecerError(grupoConsentimiento, errorConsentimiento, checkConsentimiento, "Debes aceptar el aviso de privacidad");
    return false;
  }
  limpiarError(grupoConsentimiento, errorConsentimiento, checkConsentimiento);
  return true;
}

// Validación en vivo
inputNombre.addEventListener("input", validarNombre);
inputNombre.addEventListener("blur", validarNombre);

inputApellido.addEventListener("input", validarApellido);
inputApellido.addEventListener("blur", validarApellido);

inputCorreo.addEventListener("input", validarCorreo);
inputCorreo.addEventListener("blur", validarCorreo);

inputClave.addEventListener("input", () => {
  validarClave();
  if (inputClaveConfirmar.value) {
    validarClaveConfirmar();
  }
});
inputClave.addEventListener("blur", validarClave);

inputClaveConfirmar.addEventListener("input", validarClaveConfirmar);
inputClaveConfirmar.addEventListener("blur", validarClaveConfirmar);

checkConsentimiento.addEventListener("change", validarConsentimiento);

// Envío del formulario
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombreOk = validarNombre();
  const apellidoOk = validarApellido();
  const correoOk = validarCorreo();
  const claveOk = validarClave();
  const confirmarOk = validarClaveConfirmar();
  const consentimientoOk = validarConsentimiento();

  if (!nombreOk) { inputNombre.focus(); return; }
  if (!apellidoOk) { inputApellido.focus(); return; }
  if (!correoOk) { inputCorreo.focus(); return; }
  if (!claveOk) { inputClave.focus(); return; }
  if (!confirmarOk) { inputClaveConfirmar.focus(); return; }
  if (!consentimientoOk) { checkConsentimiento.focus(); return; }

  // Deshabilitar botón durante el envío
  btnRegistro.disabled = true;
  const textoOriginal = btnRegistro.textContent;
  btnRegistro.textContent = "Registrando e iniciando sesión...";
  ui.cargando(true);

  try {
    await sesion.registrar({
      nombre: inputNombre.value.trim(),
      apellido: inputApellido.value.trim(),
      correo: inputCorreo.value.trim(),
      clave: inputClave.value,
      consentimiento: true
    });

    // Sesión iniciada automáticamente: redirigir al inicio
    window.location.href = "/index.html";
  } catch (err) {
    ui.aviso(err.message || "Error al registrar la cuenta", "error");
    btnRegistro.disabled = false;
    btnRegistro.textContent = textoOriginal;
    ui.cargando(false);
  }
});
