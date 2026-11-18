# Investigación de lentitud en Materiales (18/11/2026)

## Evidencia obtenida

- La app publicada responde con `features.material_images: 1`: el optimizador está desplegado.
- HTML inicial: 72–284 ms en tres solicitudes Node; el JavaScript inicial (~505 KB descomprimidos) se recibió en 160 ms y el CSS (~89 KB) en 359 ms. Las respuestas estaban comprimidas.
- API pública de la app: 68–84 ms con una conexión reutilizada. Al repetir con conexiones nuevas se observaron picos de 3,5–7,6 s, seguidos de respuestas rápidas. El problema observado no es exclusivo del dominio de datos.
- La ruta de salud de Supabase, sin credenciales, devolvió 401: dos solicitudes Node tardaron 7,4 y 14,7 s; otras respondieron en 0,1–0,7 s. No es una medición de las consultas autenticadas ni del tiempo de la base de datos.
- En seis solicitudes independientes con curl, DNS tardó ~6–11 ms, TLS ~79–471 ms y la respuesta completa ~178–685 ms. No se reprodujo el pico de Node en esas solicitudes. Forzar IPv4 tampoco eliminó todos los picos. No hay evidencia suficiente para atribuir el retraso al DNS, a IPv6 o a la base de datos.
- Renderizar 24 tarjetas reales con React en Node, usando datos ficticios, tardó ~172 ms la primera vez y 6–12 ms en las siguientes. Esto excluye imágenes, layout, pintura y GPU del navegador: no descarta tirones al desplazarse.
- La página espera a materiales, categorías y estancias. La paginación limita las tarjetas dibujadas, pero la consulta inicial sigue descargando la lista completa. Falta medir cuántos datos tiene la sesión afectada y cuánto tarda cada consulta.
- El lote de optimización descartaba los errores con `catch { failed++ }`. Por eso el aviso de cuatro fallos no permite reconstruir el motivo ni identificar los productos afectados.

## Diagnóstico añadido

En Materiales, **Diagnóstico de carga → Copiar informe** recoge tiempos de cada consulta, recursos lentos, errores de imágenes, tareas largas del hilo principal y una muestra de intervalos entre fotogramas. La casilla **Prueba temporal: sin efectos visuales** permite comparar el comportamiento sin filtros, desenfoques, sombras y transiciones; se desactiva al salir de la página. No cambia datos ni preferencias persistentes.

Los errores de optimización muestran ahora el material y el motivo devuelto por la API. El servidor anota la fase (`project`, `material_read`, `download`, `compression`, `storage`, `material_update`), tiempos, estado del proveedor cuando existe e identificador de petición. No registra tokens ni URLs completas.

El informe se genera localmente y solo se copia al pulsar el botón. No se envía automáticamente. Excluye URLs completas y consultas; incluye nombres de productos con fallos y dominios para poder diagnosticarlos.

## Lo que falta para confirmar la causa

No hay acceso a la sesión autenticada afectada ni a su traza del navegador. La persona indica lentitud constante, no solo durante la carga. Se necesita reproducirla tras el despliegue del diagnóstico y copiar el informe. Reintentar las cuatro imágenes pendientes permitirá conservar el motivo real de cada fallo. Comparar un informe normal y otro con la prueba sin efectos ayuda a separar composición visual de red/datos. No se considera resuelto el rendimiento por haber añadido estas mediciones.

## Informe real recibido y reproducción posterior

El informe de la sesión afectada registra 19 materiales, consultas de datos de 550–573 ms y carga total de 574 ms. Hubo una tarea larga de 1251 ms; el informe anterior no conserva su inicio ni atribución, por lo que no se puede asignar a una operación concreta. La muestra de un segundo registró 61 intervalos, separación máxima 17 ms y ninguna pausa superior a 50 ms. Esa muestra en reposo no descarta tirones al interactuar ni problemas del navegador integrado. Se ha solicitado comparación en un navegador externo.

De los cuatro fallos de optimización, dos están en compresión (415), uno en descarga bloqueada (422) y otro es una respuesta no JSON de un proxy (502/504). El cliente perdía estado e identificador en ese último caso, y etiquetaba todos los 502 como tiempos de espera. La corrección conserva los metadatos y distingue error de conexión 502 de tiempo de espera 504.

Se reprodujo el fallo 415 con el original público del azulejo Mystone (`media.adeo.com/media/3459612/media.jpg`): 8192 × 8192, 67108864 píxeles y 6736470 bytes. Supera el límite vigente de 40 millones de píxeles. Pidiendo al mismo CDN una variante de 1200 × 1200 en WebP se descargaron 143308 bytes y el compresor produjo 137798 bytes correctamente. La regla compartida solicita variantes acotadas tanto en el servidor como al dibujar tarjetas, tabla y vista previa. No se eleva el límite del decodificador ni se alteran otros proveedores o enlaces de Storage.

El usuario facilitó la URL exacta del WC (`media/6182278/media.png?width=650&height=650&format=jpg&quality=80&fit=bounds`). Esta URL ya está acotada y NO tiene el mismo problema de dimensiones. En la reproducción local devolvió WebP de 650 × 650 y 4390 bytes, y se procesó correctamente; no está demostrado el motivo del 415 de producción para ese enlace. Se añaden clasificación del fallo y detalle nativo acotado en el log del servidor para poder distinguir incompatibilidad del decodificador de una respuesta transitoria.

Tras desplegar la corrección, `/api/health` indica `features.material_images: 2`. Hay que volver a probar las imágenes pendientes y comparar la fluidez real; no se consideran resueltos los cuatro fallos ni la lentitud constante por estas pruebas locales.

El usuario confirmó después que la página va bien en Firefox. Esto apunta a un problema específico del navegador anterior o de su entorno (incluido el navegador integrado); no identifica todavía si es composición gráfica, configuración, extensiones o caché. No hay evidencia para atribuir la lentitud constante a la base de datos. El fallo reproducido de la imagen de 67 millones de píxeles se corrige por separado.
