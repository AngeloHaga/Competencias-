// publico/js/modulos/admin-ajustes.js · Panel de configuración de plataforma e IA
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Ajustes de Plataforma e IA", roles: ["admin"] });

const formIa = document.getElementById("form-ajustes-ia");
const inputProveedor = document.getElementById("input-ia-proveedor");
const inputModelo = document.getElementById("input-ia-modelo");
const inputModeloOtro = document.getElementById("input-ia-modelo-otro");
const contenedorOtroModelo = document.getElementById("contenedor-otro-modelo");
const inputClave = document.getElementById("input-ia-clave");
const inputLimite = document.getElementById("input-ia-limite");
const btnVerClave = document.getElementById("btn-ver-clave-admin");
const btnProbar = document.getElementById("btn-probar-conexion");
const divResultado = document.getElementById("resultado-prueba-ia");
const badgeEstadoIa = document.getElementById("badge-estado-ia");
const btnExportar = document.getElementById("btn-exportar-datos");
const inputImportar = document.getElementById("input-importar-datos");
const divRespaldo = document.getElementById("resultado-respaldo");

function obtenerModeloAjustes() {
  if (inputModelo?.value === "otro") {
    return (inputModeloOtro?.value || "").trim();
  }
  return (inputModelo?.value || "").trim();
}

function fijarModeloAjustes(modelo) {
  if (!inputModelo) return;
  const opciones = Array.from(inputModelo.options).map((o) => o.value);
  if (opciones.includes(modelo)) {
    inputModelo.value = modelo;
    contenedorOtroModelo?.classList.add("oculto");
  } else {
    inputModelo.value = "otro";
    if (inputModeloOtro) inputModeloOtro.value = modelo || "";
    contenedorOtroModelo?.classList.remove("oculto");
  }
}

inputModelo?.addEventListener("change", () => {
  const esOtro = inputModelo.value === "otro";
  contenedorOtroModelo?.classList.toggle("oculto", !esOtro);
  if (esOtro && inputModeloOtro) inputModeloOtro.focus();
});

btnVerClave?.addEventListener("click", () => {
  if (inputClave.type === "password") {
    inputClave.type = "text";
    btnVerClave.textContent = "🔒";
  } else {
    inputClave.type = "password";
    btnVerClave.textContent = "👁️";
  }
});

btnProbar?.addEventListener("click", async () => {
  const clave = (inputClave?.value || "").trim();
  if (!clave) {
    divResultado.className = "alerta alerta--error";
    divResultado.textContent = "❌ Por favor ingresa la clave de API antes de probar la conexión.";
    divResultado.classList.remove("oculto");
    return;
  }

  if (clave.length < 25) {
    divResultado.className = "alerta alerta--advertencia";
    divResultado.textContent = `⚠️ La clave ingresada parece incompleta (tiene ${clave.length} caracteres). Las claves completas de Gemini (iniciadas en 'AQ.' o 'AIzaSy...') tienen entre 39 y 45 caracteres. Asegúrate de copiar y pegar la clave completa.`;
    divResultado.classList.remove("oculto");
    return;
  }

  divResultado.className = "alerta alerta--info";
  divResultado.textContent = "Probando conexión con Google Gemini...";
  divResultado.classList.remove("oculto");

  try {
    const res = await api.llamar("POST", "/api/ia/prueba", {
      proveedor: inputProveedor.value,
      modelo: obtenerModeloAjustes(),
      clave
    });

    if (res.ok) {
      divResultado.className = "alerta alerta--exito";
      divResultado.textContent = `✅ ${res.mensaje}: "${res.respuesta || "Respuesta recibida"}"`;
    } else {
      divResultado.className = "alerta alerta--error";
      divResultado.textContent = `❌ ${res.error || "Fallo en la prueba de conexión"}`;
    }
  } catch (err) {
    divResultado.className = "alerta alerta--error";
    divResultado.textContent = `❌ Error: ${err.message}`;
  }
});

formIa?.addEventListener("submit", async (e) => {
  e.preventDefault();
  ui.cargando(true);

  try {
    const payload = {
      proveedor: inputProveedor.value,
      modelo: obtenerModeloAjustes(),
      clave: inputClave.value.trim(),
      limiteIADiario: Number(inputLimite.value) || 30
    };

    const res = await api.llamar("PUT", "/api/ia/config", payload);
    ui.aviso(res.mensaje || "Configuración de IA guardada con éxito", "exito");

    actualizarBadge(Boolean(payload.clave));
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la configuración", "error");
  } finally {
    ui.cargando(false);
  }
});

function actualizarBadge(tieneClave) {
  if (!badgeEstadoIa) return;
  if (tieneClave) {
    badgeEstadoIa.className = "insignia insignia--exito";
    badgeEstadoIa.textContent = "API Configurada";
  } else {
    badgeEstadoIa.className = "insignia insignia--advertencia";
    badgeEstadoIa.textContent = "Modo Respaldo";
  }
}

async function cargarConfiguracion() {
  ui.cargando(true);
  try {
    const cfg = await api.llamar("GET", "/api/ia/config");
    if (inputProveedor) inputProveedor.value = cfg.proveedor || "gemini";
    fijarModeloAjustes(cfg.modelo || "gemini-1.5-flash");
    if (inputClave) inputClave.value = cfg.clave || "";
    if (inputLimite) inputLimite.value = cfg.limiteIADiario || 30;

    actualizarBadge(Boolean(cfg.clave));
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la configuración de IA", "error");
  } finally {
    ui.cargando(false);
  }
}

cargarConfiguracion();

btnExportar?.addEventListener("click", async () => {
  ui.cargando(true);
  try {
    const res = await api.llamar("GET", "/api/respaldo/exportar");
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
    const a = document.createElement("a");
    a.href = jsonStr;
    a.download = `respaldo-ecosistema-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    ui.aviso("Copia de seguridad descargada con éxito", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al exportar los datos", "error");
  } finally {
    ui.cargando(false);
  }
});

inputImportar?.addEventListener("change", async (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;

  const confirmar = await ui.confirmar(
    `¿Deseas restaurar los contenidos desde "${archivo.name}"? Los datos actuales serán reemplazados por los del respaldo.`
  );
  if (!confirmar) {
    inputImportar.value = "";
    return;
  }

  ui.cargando(true);
  try {
    const texto = await archivo.text();
    const parseado = JSON.parse(texto);
    const payload = parseado.datos ? parseado : { datos: parseado };

    const res = await api.llamar("POST", "/api/respaldo/importar", payload);
    ui.aviso(res.mensaje || "Contenidos restaurados con éxito", "exito");
    if (divRespaldo) {
      divRespaldo.className = "alerta alerta--exito";
      divRespaldo.textContent = `✅ ${res.mensaje}`;
      divRespaldo.classList.remove("oculto");
    }
  } catch (err) {
    ui.aviso(err.message || "Error al restaurar el respaldo", "error");
    if (divRespaldo) {
      divRespaldo.className = "alerta alerta--error";
      divRespaldo.textContent = `❌ ${err.message}`;
      divRespaldo.classList.remove("oculto");
    }
  } finally {
    inputImportar.value = "";
    ui.cargando(false);
  }
});
