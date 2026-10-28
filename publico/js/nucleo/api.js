// publico/js/nucleo/api.js · Cliente HTTP para la API del ecosistema
export async function llamar(metodo, ruta, cuerpo = null) {
  const headers = {};
  const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("token") : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo.toUpperCase(),
    headers
  };

  if (cuerpo !== null && cuerpo !== undefined) {
    if (typeof FormData !== "undefined" && cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      headers["Content-Type"] = "application/json";
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const respuesta = await fetch(ruta, opciones);

  let datos = null;
  const contentType = respuesta.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
  } else if (respuesta.status === 204) {
    return { ok: true };
  }

  if (respuesta.status === 401) {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("usuario");
    }
    if (typeof window !== "undefined" && window.location) {
      const rutaActual = window.location.pathname || "";
      if (!rutaActual.endsWith("ingreso.html") && !rutaActual.endsWith("registro.html")) {
        window.location.href = "/paginas/ingreso.html";
      }
    }
    const mensajeError = datos && datos.error ? datos.error : "Sesión no autorizada o expirada";
    throw new Error(mensajeError);
  }

  if (datos && typeof datos === "object" && datos.error) {
    throw new Error(datos.error);
  }

  if (!respuesta.ok) {
    throw new Error(respuesta.statusText || `Error HTTP ${respuesta.status}`);
  }

  return datos;
}

export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros || {})) {
    if (valor !== undefined && valor !== null) {
      params.append(clave, String(valor));
    }
  }
  const consulta = params.toString();
  const ruta = consulta ? `/api/${col}?${consulta}` : `/api/${col}`;
  return await llamar("GET", ruta);
}

export async function obtener(col, id) {
  return await llamar("GET", `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return await llamar("POST", `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return await llamar("PUT", `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return await llamar("DELETE", `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  return await llamar("POST", "/api/subidas", formData);
}

export async function ia(tarea, datos) {
  return await llamar("POST", `/api/ia/${encodeURIComponent(tarea)}`, datos);
}
