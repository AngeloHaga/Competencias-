// publico/js/nucleo/util.js · Utilidades generales del navegador
export function normalizar(texto) {
  if (typeof texto !== "string") return "";
  return texto
    .trim()
    .toUpperCase()
    .replace(/Ñ/g, "\uFFFF")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFF/g, "Ñ");
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(fecha);
}

export function fechaRelativa(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const ahora = new Date();
  const diffSegundos = Math.round((fecha.getTime() - ahora.getTime()) / 1000);

  if (Math.abs(diffSegundos) < 45) {
    return "hace un momento";
  }

  const rtf = new Intl.RelativeTimeFormat("es-EC", { numeric: "auto" });

  const minutos = Math.round(diffSegundos / 60);
  if (Math.abs(minutos) < 60) {
    return rtf.format(minutos, "minute");
  }

  const horas = Math.round(minutos / 60);
  if (Math.abs(horas) < 24) {
    return rtf.format(horas, "hour");
  }

  const dias = Math.round(horas / 24);
  if (Math.abs(dias) < 30) {
    return rtf.format(dias, "day");
  }

  const meses = Math.round(dias / 30);
  if (Math.abs(meses) < 12) {
    return rtf.format(meses, "month");
  }

  const anios = Math.round(meses / 12);
  return rtf.format(anios, "year");
}

export function parametro(nombre) {
  if (typeof window === "undefined" || !window.location) return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(nombre);
}

export function formatoBasico(texto) {
  if (typeof texto !== "string" || !texto.trim()) return "";

  // 1. Escapar HTML previo para seguridad
  let seguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Convertir **texto** en <strong>texto</strong>
  seguro = seguro.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 3. Separar por bloques mediante línea en blanco
  const bloques = seguro
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return bloques
    .map((bloque) => {
      const lineas = bloque.split("\n").map((l) => l.trim()).filter(Boolean);
      const resultado = [];
      let listaActual = [];

      for (const linea of lineas) {
        if (linea.startsWith("- ")) {
          listaActual.push(`<li>${linea.slice(2)}</li>`);
        } else {
          if (listaActual.length > 0) {
            resultado.push(`<ul>${listaActual.join("")}</ul>`);
            listaActual = [];
          }
          resultado.push(linea);
        }
      }

      if (listaActual.length > 0) {
        resultado.push(`<ul>${listaActual.join("")}</ul>`);
      }

      return resultado
        .map((elem) => (elem.startsWith("<ul>") ? elem : `<p>${elem}</p>`))
        .join("");
    })
    .join("");
}
