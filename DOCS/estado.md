# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S__ · Fecha: AAAA-MM-DD · Velocidad real: __ puntos

## Funciona
- P00.1 Servidor base y almacenamiento seguro (Express, almacen.js con cola y respaldos, permisos.js, ganchos.js y API genérica).
- P00.2 Núcleo del navegador (api.js con fetch y auth, ui.js accesible con avisos/modal/cargando, util.js con normalización, fechas es-EC y formato básico).
- P00.3 Design system en CSS (tokens.css, base.css, componentes.css y guia-estilos.html basados en UNEMI con contraste AA).
- P00.4 Menú, plantilla común y página de prueba (menu.js, plantilla.js con montaje automático, index.html con inicio y prueba-datos.html interactivo).
- P01.1 Autenticación, sesiones y bitácora (auth.js, rutas auth/admin/eventos, gancho usuarios, crear-admin.js y rate limiting).
- P01.2 Registro, ingreso y sesión en el navegador (sesion.js con exigirRol, bitacora.js, plantilla.js con menú/encabezado por rol, registro con LOPDP, ingreso con validación en vivo y privacidad.html).
- P01.3 Perfil, administración de usuarios y subida de imágenes (subidas.js con multer 2MB JPG/PNG/WEBP, perfil.html con cambio de foto/clave y logros vacío, admin-usuarios.html con filtros/rol/estado y restablecer clave en modal, menu.js actualizado).
- P02.1 Colecciones académicas y acceso por grupo (acceso.js según contrato, permisos.json con lectura/escritura por rol, ganchos de asignaturas, distributivo, unidades, temas, glosario y progreso-temas, subidas.js para PDF/MP3 hasta maxSubidaMB para docente/admin).
- P02.2 Datos de prueba (semilla) (datos/semilla/ con usuarios sin claveHash, asignaturas, distributivo, unidades, temas y glosario; servidor/semilla.js con confirmación en --forzar y generación de claveHash Demo12345).
- P02.3 Asignaturas y distributivo (admin) (admin-asignaturas.html con tarjetas/modal y validación de grupos al eliminar, distributivo.html con tabla/modal con buscador y casillas de estudiantes, menu.js actualizado).
- P02.4 Editor de contenidos: unidades y temas (editor-contenidos.html para roles docente y admin con selector de asignaturas asignadas, reordenar/renombrar/visibilidad de unidades, reordenar/publicar/borrador de temas y enlace a editor de ficha; menu.js actualizado).
- P02.5 Ficha del tema y glosario (editor-tema.html con metadatos, resumen con contador 300-800 palabras y formato básico, listas de objetivos/ejemplos/errores/preguntas, recursos con subida de PDF/imágenes, glosario con métricas, cálculo de 6 letras, indicador Apto para juegos y botón Generar con IA deshabilitado).
- P02.6 Vista del estudiante y avance (catalogo-actividades.js inicial, asignaturas.html con avance porcentual y exportación de calcularAvance, asignatura.html con unidades y estado Revisado/Pendiente, tema.html con migas, objetivos, formato, recursos incrustados, marcar como revisado y localStorage, menu.js actualizado).
- P03.1 Noticias (permisos.json y ganchos de noticias y lecturas-noticias, editor-noticia.html para docente/admin con subida de imágenes y vista previa, noticias.html paginada con filtros y etiqueta Nuevo, noticia.html con lectura automática y plantilla.js con contador en menú).
- P03.2 Canciones educativas (permisos.json y ganchos de canciones, editor-cancion.html para docente/admin con MP3/LRC/licencia, canciones.html con reproductor accesible y resaltado sincronizado LRC, catalogo-actividades.js y menu.js actualizados).
- P03.3 Página de inicio (index.html, inicio.js e inicio.css con vistas sin sesión y con sesión, saludo, continuar donde te quedaste, mis asignaturas con calcularAvance, 3 noticias destacadas/recientes y accesos rápidos docente/admin).
- P04.1 Motor de gamificación en servidor (servidor/gamificacion.js con procesarIntento, cálculo de puntos, bono, unicas, maxDiario, insignias, alertas.js, rutas /intentos y /logros/:usuarioId, permisos.json y ganchos).
- P08.1 Banco de preguntas (preparadores/generar-preguntas.js con Bloom y glosario, permisos.json y ganchos/preguntas.js, banco-preguntas.html para docente/admin con pestañas Bloom 1-5, CRUD modal, propuestas IA y menu.js).
- P08.2 y P08.3 Motor del quiz y diplomas (rutas /quiz, quiz-sesiones, selector-tema.js, retroalimentacion.js, pdf.js, quiz.html/css/js con Bloom 1-5, preguntas interactivas, barra de progreso, logros y catalogo-actividades.js).
## Decisiones y cambios respecto a docs/contratos.md
-
## Problemas conocidos
-
## Pendiente para el siguiente sprint
-
