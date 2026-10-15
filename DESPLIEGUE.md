# Corrección de almacenamiento

Sube los cambios del proyecto a GitHub y despliega el nuevo commit desde Coolify.

En la aplicación de Reforma (no en el servicio Supabase), comprueba:

- `VITE_SUPABASE_URL=https://api-reforma.noxumlab.com` disponible durante build y runtime.
- `VITE_SUPABASE_ANON_KEY`: la clave pública anon del mismo proyecto, disponible durante build y runtime. No uses la clave service_role.
- Opcionalmente el servidor acepta `SUPABASE_URL` y `SUPABASE_ANON_KEY` como overrides de runtime. Deben pertenecer al mismo proyecto que las variables VITE.

El Dockerfile declara los argumentos VITE para que Coolify pueda incorporarlos a la compilación. Si solo se cambia una variable de runtime, la configuración del frontend compilado no cambia: hace falta reconstruir y desplegar.

Las subidas ahora validan el token de sesión con Supabase Auth y lo reenvían a Storage. No es necesario permitir subidas anónimas ni desactivar RLS. Los objetos nuevos pertenecen al usuario que los sube.

Los enlaces del dominio antiguo se normalizan al leer materiales, planos, imágenes de inspiración y presupuestos. Los registros de la base de datos no se modifican. Solo se reescriben enlaces del host antiguo bajo `/storage/v1/`.

Después del despliegue, comprobar: abrir el PDF existente; subir un PDF y un plano ficticios; cargar una imagen de material; verificar que aparecen y se abren; comprobar que una subida fallida muestra un aviso. Estas pruebas requieren el VPS y su configuración real. No se ha desplegado desde esta carpeta.

Validación local: `node --test tests/storage-upload.test.mjs`, `npm run build`.

## Activar el proyecto compartido

Antes de desplegar la interfaz de invitaciones, abre Supabase Studio > SQL Editor y ejecuta una sola vez el archivo completo `supabase/migrations/00022_shared_workspace.sql`. La migración conserva los registros actuales, añade propietario y colaboradores, y reemplaza las políticas individuales por políticas de acceso al proyecto. También amplía el acceso seguro a documentos y archivos compartidos.

Después sube el código y reconstruye la aplicación en Coolify. En `/api/health` debe aparecer `release: multi-project-sharing-v1`. Prueba el flujo con un segundo email: crea la invitación en Ajustes, abre el enlace en una ventana privada, registra o inicia sesión con ese mismo email y confirma que ambas cuentas ven la misma tarea. Finalmente elimina esa tarea de prueba y retira el acceso desde la cuenta propietaria.

No ejecutes `npm run migrate` para esta función: ese script antiguo no incluye `00022_shared_workspace.sql`.

## Instalar NIVEL en el móvil

NIVEL incluye manifest, service worker e iconos propios, por lo que puede instalarse como PWA después de desplegarla por HTTPS. No necesita una aplicación separada ni publicación en las tiendas.

- Android: abre NIVEL en Chrome y pulsa «Instalar NIVEL» en el menú lateral. También puede aparecer el aviso nativo «Instalar aplicación».
- iPhone/iPad: abre NIVEL en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». El botón «Instalar NIVEL» muestra estas instrucciones dentro de la aplicación.

La PWA solo almacena la carcasa visual y recursos estáticos. Las rutas `/api`, las sesiones y los datos de Supabase no se guardan en la caché offline. Para regenerar los iconos desde la marca actual, ejecuta `npm run pwa:icons`.

## Activar Tareas

Antes de desplegar la versión con Tareas, abre Supabase Studio > SQL Editor y ejecuta únicamente `supabase/migrations/00013_tasks.sql`. La migración crea la tabla, sus índices y permisos por usuario dentro de una transacción. No borra tablas ni datos existentes. Ejecutarla una vez; si ya existe una tabla tasks de otra implementación, comprobar su esquema antes de aplicarla.

El script antiguo `npm run migrate` no incluye esta migración y vuelve a ejecutar migraciones anteriores: no lo uses para activar Tareas.

Después sube el código a GitHub y redeploy en Coolify. Comprueba crear, editar, completar, reabrir y eliminar una tarea ficticia; filtrar por estado/estancia/prioridad y verificar fechas vencidas. Las pruebas de persistencia y aislamiento entre usuarios requieren Supabase y están pendientes de ejecutar tras aplicar la migración.

### Activar los pasos dentro de una tarea

Si la tabla `tasks` ya está activa, ejecuta únicamente `supabase/migrations/00017_task_items.sql` en Supabase Studio > SQL Editor antes de desplegar esta versión. La migración crea la checklist asociada a cada tarea, su índice y las políticas que limitan el acceso al propietario de la tarea. Al eliminar una tarea, sus pasos se eliminan automáticamente.

Tras el redeploy, crea una tarea con varios pasos, marca algunos desde la tarjeta y comprueba el contador de progreso. Verifica también que completar la tarea principal completa todos sus pasos y que desmarcar un paso de una tarea completada cambia la tarea a «En curso».

## Activar Gastos y pagos

Abre Supabase Studio > SQL Editor y ejecuta únicamente `supabase/migrations/00014_expenses.sql`. Crea la tabla de gastos, sus índices y las políticas que aíslan los datos de cada usuario. No borra ni modifica materiales, presupuestos, tareas u otros datos existentes.

Después sube el código a GitHub y haz redeploy en Coolify. Comprueba crear un gasto pendiente, editarlo con un pago parcial, marcarlo como totalmente pagado indicando el mismo importe y eliminar un gasto de prueba. El estado se calcula automáticamente a partir del coste final y la cantidad pagada.

## Activar Proveedores

Después de aplicar `00014_expenses.sql`, ejecuta únicamente `supabase/migrations/00015_suppliers.sql` en Supabase Studio > SQL Editor. Crea los proveedores, añade su relación opcional con los gastos y actualiza las políticas de gastos para impedir asociar proveedores de otro usuario.

Tras el redeploy, crea un proveedor, edítalo y selecciónalo en un gasto. Al eliminar un proveedor, el gasto permanece y conserva el nombre que figuraba en la factura.

### Contacto, opinión y oficios personalizados

Después de tener activa `00015_suppliers.sql`, ejecuta únicamente `supabase/migrations/00018_supplier_contact_and_trades.sql` en Supabase Studio > SQL Editor. La migración añade el indicador de contacto y la opinión, y permite escribir cualquier especialidad u oficio en lugar de limitarse a una lista cerrada. No modifica los proveedores existentes: inicialmente aparecerán como «Por contactar» y conservarán todos sus datos.

Tras el redeploy, comprueba un proveedor marcado como contactado, otro pendiente de contacto y el filtro correspondiente. Añade también un proveedor con el oficio «Lampista» y otro con un oficio nuevo escrito manualmente; ambos deben poder guardarse y aparecer en el filtro de especialidades.

## Activar Fotos de progreso

Ejecuta únicamente `supabase/migrations/00016_progress_photos.sql` en Supabase Studio > SQL Editor. La migración crea el diario fotográfico y sus políticas por usuario; reutiliza el bucket `images` que ya existe, por lo que no crea otro almacenamiento.

Tras el redeploy, añade una imagen ficticia, edita su fase y estancia, comprueba los filtros y elimínala. Al eliminarla desde Progreso también se elimina el objeto correspondiente del bucket `images`.
