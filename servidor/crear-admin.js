// servidor/crear-admin.js · Creación interactiva de usuario administrador por consola
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import * as almacen from "./almacen.js";

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("=== Crear usuario administrador ===");

    const nombre = (await rl.question("Nombre: ")).trim();
    const apellido = (await rl.question("Apellido: ")).trim();
    const correo = (await rl.question("Correo: ")).trim().toLowerCase();
    const clave = (await rl.question("Contraseña: ")).trim();

    if (!nombre || !apellido || !correo || !clave) {
      console.error("Error: Todos los campos son obligatorios.");
      process.exit(1);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      console.error("Error: El formato de correo no es válido.");
      process.exit(1);
    }

    if (clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
      console.error("Error: La contraseña debe tener al menos 8 caracteres y contener letras y números.");
      process.exit(1);
    }

    const usuarios = await almacen.leer("usuarios");
    if (usuarios.some((u) => u.correo && u.correo.toLowerCase() === correo)) {
      console.error("Error: Ya existe un usuario con ese correo electrónico.");
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevo = await almacen.agregar("usuarios", {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: "admin",
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    console.log(`\n¡Administrador creado con éxito!`);
    console.log(`ID: ${nuevo.id}`);
    console.log(`Nombre: ${nuevo.nombre} ${nuevo.apellido}`);
    console.log(`Correo: ${nuevo.correo}`);
    console.log(`Rol: ${nuevo.rol}`);
  } catch (err) {
    console.error("Error al crear administrador:", err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
