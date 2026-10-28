// publico/js/nucleo/pdf.js · Generación accesible de diplomas académicos en PDF
import * as api from "./api.js";
import { usuarioActual } from "./sesion.js";
import * as ui from "./ui.js";

async function asegurarJsPDF() {
  if (typeof window !== "undefined" && window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error("No se pudo cargar jsPDF"));
      }
    };
    s.onerror = () => reject(new Error("Fallo al conectar con CDN de jsPDF"));
    document.head.appendChild(s);
  });
}

/**
 * Genera y descarga el diploma de acreditación en PDF
 * @param {Object} opciones { tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = "nivel-quiz", temaId, nivel = 1 }) {
  const usuario = usuarioActual();
  const nombreEstudiante = usuario ? `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim() : "Estudiante";

  let tituloTema = "Tema de Aprendizaje";
  if (temaId) {
    try {
      const temaObj = await api.obtener("temas", temaId);
      if (temaObj && temaObj.titulo) tituloTema = temaObj.titulo;
    } catch {
      // Ignorar fallo de lectura secundaria
    }
  }

  const codigo = `DIP-${tipo === "nivel-quiz" ? `Q${nivel}` : "CUMP"}-${Date.now().toString(36).toUpperCase()}`;

  ui.cargando(true);
  try {
    const jsPDF = await asegurarJsPDF();
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // Marco ornamental
    doc.setDrawColor(30, 58, 138); // Azul institucional
    doc.setLineWidth(2);
    doc.rect(10, 10, 277, 190);

    doc.setDrawColor(202, 138, 4); // Dorado
    doc.setLineWidth(0.8);
    doc.rect(14, 14, 269, 182);

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(30, 58, 138);
    doc.text("ECOSISTEMA EDUCATIVO DIGITAL", 148, 35, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139);
    doc.text("CERTIFICACIÓN DE LOGRO PEDAGÓGICO", 148, 45, { align: "center" });

    // Otorgado a
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text("Se confiere el presente diploma a:", 148, 65, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(nombreEstudiante.toUpperCase(), 148, 80, { align: "center" });

    // Detalle de superación
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(51, 65, 85);

    const nombresBloom = {
      1: "Recordar",
      2: "Comprender",
      3: "Aplicar",
      4: "Analizar",
      5: "Evaluar"
    };

    const detalleLogro =
      tipo === "nivel-quiz"
        ? `Por haber aprobado satisfactoriamente el Nivel ${nivel} (${nombresBloom[nivel] || "Bloom"}) en el Quiz Evaluativo del tema:`
        : "Por haber cumplido con éxito todos los requisitos académicos del tema:";

    doc.text(detalleLogro, 148, 100, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(`"${tituloTema}"`, 148, 112, { align: "center" });

    // Código de verificación y fecha
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const fechaEmision = new Date().toLocaleDateString("es-EC", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    doc.text(`Fecha de emisión: ${fechaEmision}`, 40, 155);
    doc.text(`Código de verificación: ${codigo}`, 40, 162);

    // Firmas
    doc.line(180, 155, 250, 155);
    doc.text("Dirección Académica", 215, 162, { align: "center" });

    doc.save(`Diploma-${tipo}-Nivel-${nivel}.pdf`);
    ui.aviso("Diploma generado y descargado correctamente", "exito");
    return { codigo };
  } catch (err) {
    ui.aviso("No se pudo generar el PDF del diploma: " + err.message, "error");
    return { codigo };
  } finally {
    ui.cargando(false);
  }
}
