# Revisión funcional — 7 de octubre de 2026

Aplicación: https://reforma.noxumlab.com/

Se revisaron el proyecto local y la aplicación desplegada con la sesión iniciada por el propietario. Las operaciones de escritura se limitaron a elementos ficticios PRUEBA CODEX, con autorización explícita para crearlos y eliminarlos. No se desplegaron cambios ni se modificó código de la aplicación.

## Pruebas realizadas

| Prueba | Resultado |
| --- | --- |
| Acceso y navegación de las secciones existentes | Correcto; sesión iniciada por el propietario |
| Carga de materiales | 20 materiales originales |
| Búsqueda NOA | 1 material, 249 € × 2 = 498 € |
| Filtro Baño | 2 materiales, total 736 € |
| Importación de producto de ClimaMarket | Nombre, marca y precio 1145,14 EUR extraídos y trasladados al formulario; no se guardó el producto importado |
| Crear material ficticio | Correcto: 12,34 € × 3 = 37,02 € |
| Editar material ficticio | Correcto: cantidad 2 y estado Comprado; total 24,68 € |
| Excluir material ficticio de totales | Correcto: total de la búsqueda pasa a 0 € |
| Borrar material ficticio | Correcto; vuelve a haber 20 materiales originales |
| Crear, editar y borrar nota ficticia | Correcto; se conserva la nota original |
| Crear, editar y borrar categoría propia ficticia | Correcto |
| Crear y borrar estancia ficticia | Correcto |
| Crear, editar y borrar inspiración ficticia con URL | Correcto; sin subir imagen |
| Abrir PDF existente | Fallo: el iframe muestra que no puede resolver api-reforma.bycram.dev |
| Subir PDF ficticio | Fallo: fetch failed; el formulario no muestra un error al usuario |
| Subir PNG ficticio como plano | Fallo: fetch failed; no se crea un plano y no se muestra un error al usuario |
| Compilación local npm run build | Correcta después de instalar dependencias y ejecutarla fuera del sandbox |
| Sintaxis server.js y scripts/migrate.mjs | Correcta con node --check |

Al terminar se verificó el dashboard original: 20 materiales, total 13.582,74 €. Los registros ficticios creados se eliminaron. Las subidas fallidas no crearon registros de planos ni presupuestos. No se puede confirmar desde la interfaz si quedó algún objeto huérfano en Storage; para comprobarlo hace falta acceso a Storage o a los logs del VPS.

## Fallos reproducidos en el VPS

### Alta: lectura y subida de archivos

El PDF existente apunta a https://api-reforma.bycram.dev/storage/v1/object/public/budget-pdfs/… y el navegador muestra un error de resolución DNS. Las pruebas de subida de PDF y plano devuelven fetch failed. El servidor local contiene ese dominio fijado en las rutas de Storage (server.js:340, 397, 428 y sus URL públicas).

Hay que comprobar el dominio y la configuración real de Supabase en el VPS, usar una URL configurable y revisar los enlaces ya almacenados. No se ha accedido a logs ni DNS del VPS para demostrar la causa de los fallos de subida; el problema DNS del visor sí se observó directamente.

### Media: los errores de subida quedan ocultos

BudgetPDFs.jsx:64 y FloorPlan.jsx:52 capturan errores y solo los escriben en consola. El usuario vuelve al formulario sin una explicación ni una indicación clara de fallo. El mismo patrón aparece en otros guardados. Materiales además ignora materialsData.error al cargar y puede presentar una lista vacía cuando la consulta falla (Materials.jsx:64).

## Problemas del código que requieren corrección o contraste con el VPS

- Alta: los endpoints de importación y subida de server.js no verifican sesión. Los fetch de URL recibidas tampoco limitan destinos privados, redirecciones, tiempo ni tamaño de respuesta. No se hicieron pruebas ofensivas contra el VPS.
- Alta: las subidas del servidor usan VITE_SUPABASE_ANON_KEY como Bearer, sin trasladar la sesión del usuario. Las políticas de Storage incluidas exigen authenticated. Debe contrastarse con las políticas realmente instaladas.
- Alta: no hay migración que cree el bucket budget-pdfs. El PDF existente demuestra que hay configuración adicional en el VPS que no está reflejada completamente en este repositorio.
- Media: Settings permite editar y borrar categorías/estancias por defecto con user_id NULL, pero las políticas incluidas solo permiten esas operaciones al propietario. Se probaron categorías propias; no se modificaron los valores por defecto.
- Media: la moneda del importador empieza en EUR y después usa ||=, por lo que no se sustituye por otra moneda encontrada (server.js:74, 118, 143). La prueba realizada fue con un producto en EUR.
- Media: BudgetGridConfig cierra el diálogo antes de esperar a que onSave termine (líneas 84–85). Puede parecer guardado aunque falle. Al reducir la cuadrícula, el servicio hace upsert y no elimina las celdas fuera de las nuevas dimensiones. No se modificó la cuadrícula original.
- Menor: una nota nueva no tiene botón Cancelar; hay que abandonar la sección para descartar el editor.
- Facturas, proveedores y tareas están deshabilitados expresamente en Sidebar.jsx; no son funcionalidades implementadas.

## Dependencias y rendimiento

La consulta npm audit informa 42 paquetes afectados: 1 crítico, 9 altos, 31 moderados y 1 bajo. El detalle se guarda en audit-review.json. El recuento incluye dependencias transitivas y herramientas de desarrollo; no equivale a 42 fallos explotables en la aplicación. La entrada crítica corresponde a proxy-addr; hay avisos altos para multer, entre otros. Se requiere revisar aplicabilidad y actualizar con validación, sin ejecutar automáticamente audit fix --force.

La compilación genera un archivo JavaScript de aproximadamente 967 kB (285 kB comprimido) y avisa de su tamaño. Conviene separar pantallas mediante carga diferida después de corregir los fallos funcionales.

## Límites de esta revisión

No se verificaron registro, recuperación de contraseña, cierre de sesión, aislamiento entre usuarios, permisos reales de la base de datos, backups, logs del VPS, envío de correos, creación desde cero de la infraestructura, ni navegadores nativos iOS/Android. Tampoco se probaron todas las tiendas del importador, la subida directa de imagen de material, la duplicación de materiales o el guardado de la cuadrícula original. No existe script de tests en package.json.

Prioridad propuesta: resolver lectura/subida de archivos y mostrar sus errores; proteger la API y alinear Storage; actualizar dependencias; completar regresión en un entorno de pruebas.
