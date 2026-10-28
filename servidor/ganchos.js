// servidor/ganchos.js · Carga y ejecución dinámica de ganchos por colección
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ganchosPorCol = new Map();
const dirGanchos = path.resolve(import.meta.dirname, "ganchos");

// Carga inicial de ganchos presentes en servidor/ganchos/<col>.js
try {
  const archivos = await fs.readdir(dirGanchos);
  for (const arch of archivos) {
    if (arch.endsWith(".js")) {
      const col = path.basename(arch, ".js");
      const ruta = path.join(dirGanchos, arch);
      const mod = await import(pathToFileURL(ruta).href);
      ganchosPorCol.set(col, mod.default || mod);
    }
  }
} catch (err) {
  console.error("Error al inicializar ganchos:", err);
}

// Aplica un gancho si existe; si no existe devuelve el primer argumento recibido
export async function aplicar(col, nombre, ...args) {
  const clave = col.includes("/") ? col.split("/")[0] : col;
  let ganchoColeccion = ganchosPorCol.get(col) || ganchosPorCol.get(clave);

  if (!ganchoColeccion) {
    try {
      const ruta = path.join(dirGanchos, `${col}.js`);
      const mod = await import(pathToFileURL(ruta).href);
      ganchoColeccion = mod.default || mod;
      ganchosPorCol.set(col, ganchoColeccion);
    } catch {
      // No existe archivo de gancho para esta colección
    }
  }

  if (!ganchoColeccion || typeof ganchoColeccion[nombre] !== "function") {
    return args[0];
  }

  return await ganchoColeccion[nombre](...args);
}
