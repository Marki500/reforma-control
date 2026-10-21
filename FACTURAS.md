# Facturas

## Flujo

En **Compras y costes > Facturas**, subir PDF, JPG, PNG o WebP (hasta 20 MB).
Opcionalmente analizar con IA (hasta 14 MB), revisar los datos, confirmar la revisión
y registrar. La factura y su gasto se guardan en una transacción.

Se extraen emisor, NIF/CIF, número, fecha, vencimiento, moneda, base, IVA, total,
concepto, notas y partidas. La IA no registra pagos. El formulario también permite
rellenar todo manualmente cuando la extracción no está disponible.

Si el gasto de destino tiene un plan de pagos por fases (migración 00032), sus pagos
y vencimientos se gestionan en Gastos. Al vincularlo, el total de la factura debe
coincidir con el coste del gasto y se conserva su pagado acumulado. Ajustar antes
el plan en Gastos si cambia el coste; no se redistribuyen fases automáticamente.

Al vincular un gasto existente —incluidos los de presupuestos aceptados— se actualiza
su importe final sin crear otro gasto. Se carga el pagado acumulado existente y se
comprueba en base de datos que ningún otro usuario lo haya modificado mientras tanto.
El campo pagado es un acumulado, nunca un pago adicional.

Desde Gastos se abre la factura; desde Facturas se abre el gasto. El estado de pago
se deriva del gasto. El importe facturado queda protegido; los pagos siguen siendo
editables. Retirar una factura elimina el documento y su vínculo, conservando gasto
y pagos. La limpieza del archivo usa la cola persistente de 00029.

## Alcance de esta versión

- Facturas en EUR con total positivo. Sin conversión de divisas, abonos ni rectificativas negativas.
- Una factura por gasto. Para facturas parciales, crear gastos separados; no vincular
  una factura parcial al gasto que representa el compromiso completo del presupuesto.
- Si se informan base e IVA, su suma debe coincidir con el total (tolerancia 0,05 €).
  Con varios tipos de IVA se puede dejar el porcentaje vacío y conservar el IVA total.
- Duplicados bloqueados por proyecto y número normalizado, tanto para emisor como
  para NIF/CIF o proveedor guardado. Los reintentos reutilizan el identificador original.
- Los documentos se guardan en un bucket privado, con enlaces de lectura temporales.
- Visores solo pueden consultar. Propietarios y editores pueden registrar y retirar.
- Facturas incluidas en búsqueda global y copia JSON de los registros.

## Publicación

Aplicar primero 00029 si está pendiente y después, una sola vez,
`supabase/migrations/00030_invoices.sql`. Reconstruir y desplegar frontend y servidor.
La migración necesita las anteriores y no debe ejecutarse con el script histórico
`npm run migrate`, que solo contiene las migraciones 00004–00010.

`/api/health` debe mostrar `release: pdf-vision-v1`, `ai_invoice_async: 1` y
`ai_budget_async: 6`. Se conservan proveedor, claves, restricciones de coste y cupo
compartido con Presupuestos. Con Groq, los PDF con texto se extraen localmente;
los PDF escaneados o mixtos y las imágenes usan el respaldo visual de OpenRouter.
La lectura visual admite hasta 8 páginas; una extracción sin importes se rechaza.
Consultar `IA_PRESUPUESTOS.md` para el detalle de límites y reintentos. Sin respaldo, el formulario
manual sigue disponible. No se ha llamado a proveedores reales durante las pruebas.

## Validación local

`node --test tests/*.test.mjs` y `npm run build`.
Con `PGLITE_MODULE` apuntando a una instalación temporal de PGlite:
`node tests/invoices-db.mjs` prueba transacciones, duplicados, reintentos, pagos,
permisos y borrado de proyectos sin conectarse a Supabase real.

`npx vite --config tests/ui-preview.config.mjs` permite revisar `/facturas` y `/gastos`
con datos ficticios, extracción simulada y archivo generado en memoria. Esta vista
no llama a Supabase ni guarda documentos reales.

Referencias de la integración visual: [imágenes en OpenRouter](https://openrouter.ai/docs/guides/overview/multimodal/overview)
y [comprensión de imágenes en Gemini](https://ai.google.dev/gemini-api/docs/image-understanding).
