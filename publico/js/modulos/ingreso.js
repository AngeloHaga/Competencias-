// publico/js/modulos/ingreso.js · Lógica de inicio de sesión con validación en vivo
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as sesion from "../nucleo/sesion.js";
import * as ui from "../nucleo/ui.js";

// Si ya existe sesión guardada, verificar si sigue siendo válida antes de redirigir
if (sesion.usuarioActual() && sesion.token()) {
  try {
    await api.llamar("GET", "/api/auth/yo");
    window.location.href = "/index.html";
  } catch {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");
  }
}

await montarPlantilla({ titulo: "Iniciar sesión", roles: ["publico"] });

const form = document.getElementById("formIngreso");
const inputCorreo = document.getElementById("correo");
const inputClave = document.getElementById("clave");
const errorCorreo = document.getElementById("errorCorreo");
const errorClave = document.getElementById("errorClave");
const grupoCorreo = document.getElementById("grupoCorreo");
const grupoClave = document.getElementById("grupoClave");
const btnIngreso = document.getElementById("btnIngreso");

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  limpiarError(grupoClave, errorClave, inputClave);
  return true;
}

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

// Validación en vivo al escribir y al salir del campo
inputCorreo.addEventListener("input", validarCorreo);
inputCorreo.addEventListener("blur", validarCorreo);

inputClave.addEventListener("input", validarClave);
inputClave.addEventListener("blur", validarClave);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correoValido = validarCorreo();
  const claveValida = validarClave();

  if (!correoValido) {
    inputCorreo.focus();
    return;
  }
  if (!claveValida) {
    inputClave.focus();
    return;
  }

  // Deshabilitar botón mientras envía
  btnIngreso.disabled = true;
  const textoOriginal = btnIngreso.textContent;
  btnIngreso.textContent = "Ingresando...";
  ui.cargando(true);

  try {
    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    await sesion.iniciar(correo, clave);
    window.location.href = "/index.html";
  } catch (err) {
    ui.aviso(err.message || "Error al iniciar sesión", "error");
    btnIngreso.disabled = false;
    btnIngreso.textContent = textoOriginal;
    ui.cargando(false);
  }
});
