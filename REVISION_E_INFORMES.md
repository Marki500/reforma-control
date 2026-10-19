# Revisión de documentos e informes

## Revisar antes de guardar

Al subir un presupuesto o factura, la ventana se amplía cuando hay un documento.
En ordenador, muestra el original y los campos en columnas; en móvil se apilan.
El PDF se dibuja localmente con PDF.js, con navegación de páginas y zoom. JPG,
PNG y WebP se muestran como imagen. Hay un enlace al original en otra pestaña.
Los enlaces temporales del archivo se revocan al cambiarlo o cerrar la revisión.
La vista previa no sube el documento ni solicita otro análisis de IA.

Las comprobaciones se actualizan al editar: datos ausentes, total no positivo y
base más IVA distinta del total (tolerancia 0,05 €). Los campos pendientes se
resaltan. Son avisos de revisión; no son porcentajes de confianza del modelo.
Se conservan las validaciones obligatorias de registro de facturas.
En presupuestos se pueden corregir número, base, IVA y total antes de guardar;
los valores corregidos son los que se guardan. Cambiar el archivo borra el
borrador anterior. Hay que confirmar la revisión y editar después la desmarca.

## Exportar

En **Ajustes > Informes de la reforma**:

- **Gastos en Excel (.xlsx)**: hojas Resumen y Gastos, importes numéricos en EUR,
  proveedor, estancia, fechas, categoría, número de factura y notas. Filtro,
  cabecera inmovilizada, fórmulas de pendiente/estado/totales y resultados
  iniciales guardados para lectores que no recalculen automáticamente.
  Los textos que empiezan por `=` se conservan como texto, no como fórmula.
- **Informe de reforma (.pdf)**: presupuesto general, gastos registrados,
  facturado, pagado, pendiente, margen, porcentaje de tareas completadas,
  desglose por categoría y detalle de gastos con paginación automática.

Ambas descargas consultan todos los registros de la reforma activa mediante
paginación y filtro explícito por proyecto, con la sesión y los permisos vigentes.
Un fallo de lectura cancela la descarga, evitando informes parciales. Un cambio
de reforma durante la carga obliga a reintentar. No se modifica la base de datos.
Son lecturas sucesivas, no una instantánea transaccional: conviene generarlas
cuando no se estén modificando registros desde otras cuentas.

Las facturas vinculadas ya están incluidas en los gastos y no se suman de nuevo.
El pendiente se calcula por gasto, sin compensar otras deudas con pagos de más.
El presupuesto general procede de los datos de la reforma, no de sumar ofertas.
Si falta, se indica «Sin definir». El margen solo compara gastos registrados:
no estima el coste final de la obra. El avance cuenta tareas, sin ponderar duración.
Los informes no incluyen adjuntos. El PDF usa fuentes con caracteres españoles;
otros alfabetos o emoji se sustituyen por `?` en los textos del informe.

Las librerías de exportación y el visor PDF se cargan bajo demanda. Las descargas
se generan en el navegador, sin un nuevo servicio externo ni claves adicionales.

## Publicación y pruebas

Reconstruir y desplegar la app. No requiere nuevas migraciones; conserva como
requisitos las migraciones de presupuestos y facturas ya documentadas.

`node --test tests/*.test.mjs` verifica cálculos, paginación, errores parciales,
documentos vacíos, contenido del PDF y lectura del Excel generado, además de las
regresiones existentes. `npm run build` comprueba la compilación de producción.
El informe PDF de prueba se ha renderizado e inspeccionado visualmente.

Para la prueba opcional de navegador, ejecutar primero
`npx vite --config tests/ui-preview.config.mjs`, definir `PLAYWRIGHT_MODULE` con
la ruta de `playwright/index.mjs` y `UI_OUTPUT` con una carpeta de capturas, y
ejecutar `node tests/review-report-ui.mjs`. Requiere Chrome instalado. Usa solo
datos y documentos ficticios: visor y zoom, avisos que desaparecen al corregir,
pantalla móvil, confirmación de presupuesto y descargas Excel/PDF con errores.
No comprueba una instalación nativa de Microsoft Excel ni modifica Supabase real.
