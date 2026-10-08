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

## Activar Tareas

Antes de desplegar la versión con Tareas, abre Supabase Studio > SQL Editor y ejecuta únicamente `supabase/migrations/00013_tasks.sql`. La migración crea la tabla, sus índices y permisos por usuario dentro de una transacción. No borra tablas ni datos existentes. Ejecutarla una vez; si ya existe una tabla tasks de otra implementación, comprobar su esquema antes de aplicarla.

El script antiguo `npm run migrate` no incluye esta migración y vuelve a ejecutar migraciones anteriores: no lo uses para activar Tareas.

Después sube el código a GitHub y redeploy en Coolify. Comprueba crear, editar, completar, reabrir y eliminar una tarea ficticia; filtrar por estado/estancia/prioridad y verificar fechas vencidas. Las pruebas de persistencia y aislamiento entre usuarios requieren Supabase y están pendientes de ejecutar tras aplicar la migración.
