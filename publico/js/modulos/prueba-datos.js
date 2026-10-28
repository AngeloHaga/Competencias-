// publico/js/modulos/prueba-datos.js · Formulario y listado de la colección prueba
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({ titulo: "Prueba de datos", roles: ["publico"] });

const contenido = document.getElementById("contenido");

if (contenido) {
  contenido.innerHTML = `
    <div class="panel-prueba">
      <section class="tarjeta">
        <h2 style="margin-bottom: var(--espacio-s);">Agregar nuevo registro</h2>
        <p style="color: var(--color-texto-suave); margin-bottom: var(--espacio-m);">
          Este formulario interactúa directamente con el almacenamiento seguro del servidor mediante <code>api.crear()</code>.
        </p>
        <form id="formularioPrueba" class="pila">
          <div class="campo">
            <label for="campoTexto">Texto a guardar</label>
            <input type="text" id="campoTexto" name="texto" placeholder="Escribe un mensaje o dato de prueba..." required autocomplete="off">
          </div>
          <div class="fila" style="justify-content: flex-end;">
            <button type="submit" class="btn btn--primario" id="btnGuardar">Guardar registro</button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-m);">
          <h2>Registros guardados</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btnRecargar">Actualizar lista</button>
        </div>
        <div id="contenedorLista">
          <div class="cargando--centrado">
            <div class="cargando" aria-label="Cargando registros"></div>
          </div>
        </div>
      </section>
    </div>
  `;

  const form = document.getElementById("formularioPrueba");
  const inputTexto = document.getElementById("campoTexto");
  const contenedorLista = document.getElementById("contenedorLista");
  const btnRecargar = document.getElementById("btnRecargar");

  async function cargarRegistros() {
    try {
      const registros = await api.listar("prueba");
      if (!Array.isArray(registros) || registros.length === 0) {
        contenedorLista.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono">📝</div>
            <h3 class="vacio__titulo">No hay registros guardados</h3>
            <p class="vacio__descripcion">Ingresa un texto en el formulario superior para almacenar el primer dato.</p>
          </div>
        `;
        return;
      }

      // Ordenar por fecha descendente (más recientes primero)
      const ordenados = [...registros].reverse();

      const itemsHtml = ordenados.map((item) => {
        const idEscapado = ui.escapar(item.id || "");
        const textoEscapado = ui.escapar(item.texto || item.nombre || "");
        const fechaLegible = item.fecha ? util.fechaRelativa(item.fecha) : "";

        return `
          <div class="registro-item">
            <span class="registro-item__id">${idEscapado}</span>
            <span class="registro-item__texto">${textoEscapado}</span>
            <span class="registro-item__fecha">${fechaLegible}</span>
          </div>
        `;
      }).join("");

      contenedorLista.innerHTML = `<div class="lista-registros">${itemsHtml}</div>`;
    } catch (err) {
      ui.aviso(`Error al cargar registros: ${err.message}`, "error");
      contenedorLista.innerHTML = `
        <div class="alerta alerta--error" role="alert">
          <strong>Error de carga</strong> No se pudieron obtener los registros. ${ui.escapar(err.message)}
        </div>
      `;
    }
  }

  // Enviar formulario
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = inputTexto.value.trim();
      if (!texto) {
        ui.aviso("El campo texto no puede estar vacío", "advertencia");
        return;
      }

      try {
        ui.cargando(true);
        await api.crear("prueba", { texto });
        ui.aviso("Registro guardado con éxito", "exito");
        inputTexto.value = "";
        await cargarRegistros();
      } catch (err) {
        ui.aviso(`Error al guardar: ${err.message}`, "error");
      } finally {
        ui.cargando(false);
      }
    });
  }

  if (btnRecargar) {
    btnRecargar.addEventListener("click", cargarRegistros);
  }

  // Carga inicial
  await cargarRegistros();
}
