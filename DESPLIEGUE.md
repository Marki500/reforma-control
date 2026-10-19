# Corrección de almacenamiento

## Revisión de documentos e informes — 19 de octubre de 2026

Reconstruir y desplegar la aplicación. No hay migraciones nuevas. La revisión
de presupuestos y facturas muestra original y formulario juntos, con visor PDF
propio y avisos de datos ausentes o descuadres. En Ajustes se añaden las descargas
de gastos en Excel y del informe de reforma en PDF. Consultar
`REVISION_E_INFORMES.md` para alcance, cálculos y comprobaciones. Se ha validado
localmente con datos ficticios; no se ha desplegado desde esta revisión.

## Lectura visual de PDF — 19 de octubre de 2026

Reconstruir y desplegar servidor y frontend. No requiere una migración nueva.
`/api/health` debe mostrar `release: pdf-vision-v1`, `ai_pdf_vision: 1` y
`ai_extraction_validation: 1`, conservando las funciones de facturas y presupuestos.
Con Groq, conservar el respaldo `OPENROUTER_API_KEY` y `OPENROUTER_MODEL=openrouter/free`
para documentos escaneados. No se usa el plugin de PDF remoto: las páginas se
renderizan en el servidor y se envían como imágenes. Consultar `IA_PRESUPUESTOS.md`.
El límite visual es de 8 páginas; las extracciones vacías se rechazan.
Validado con proveedores simulados y renderizado local; falta la comprobación
con el proveedor configurado tras desplegar. No se ha desplegado desde esta revisión.

## Facturas — 19 de octubre de 2026

Aplicar `supabase/migrations/00030_invoices.sql` después de 00029 y desplegar tanto
servidor como frontend. Crea el bucket privado de facturas, permisos, registro
atómico en Gastos y protección de importes vinculados. Consultar `FACTURAS.md`
para el flujo, límites y pruebas. La versión del servidor pasa a `invoices-v1`,
con `features.ai_invoice_async: 1`. Esta migración no se ha aplicado al VPS desde
esta revisión.

## Mejoras del resumen y borrado seguro — 19 de octubre de 2026

Antes de publicar esta versión, ejecutar una vez la migración completa
`supabase/migrations/00029_safe_project_deletion.sql` en la misma base de datos
que ya tiene las migraciones 00001–00028. Después reconstruir y desplegar la app.
No utilizar `npm run migrate` para esta operación: el script histórico solo incluye 00004–00010.

00029 conserva las comprobaciones de propietario y de última reforma activa.
Registra los objetos de Storage y elimina la reforma en una sola transacción.
Si la transacción falla, no se confirma ninguna limpieza. La interfaz elimina
archivos solo después del éxito; cualquier fallo de Storage queda en una cola
persistente, visible y reintentable desde Ajustes > Datos de la reforma.
La cola limita el acceso a su solicitante y a los objetos exactos del borrado;
los archivos referenciados por otras reformas se conservan.

Sin 00029, la nueva operación de borrado falla sin tocar archivos. Esta migración
se ha comprobado con PostgreSQL embebido y datos ficticios; no se ha ejecutado
contra la base de datos desplegada desde esta revisión.

Validación: `node --test tests/*.test.mjs` y `npm run build`.
Prueba SQL opcional: instalar `@electric-sql/pglite` fuera del proyecto, definir
`PGLITE_MODULE` con la ruta absoluta de su `dist/index.js` y ejecutar
`node tests/project-deletion-db.mjs`. Nunca usa `DATABASE_URL`.
Vista de comprobación sin datos reales: `npx vite --config tests/ui-preview.config.mjs`,
abrir `http://127.0.0.1:4175/dashboard` o `/materials`; añadir `?error` para simular
un fallo de carga. La vista solo admite lecturas ficticias y no sirve para guardar cambios.

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

Si `00022_shared_workspace.sql` ya se ejecutó antes de incorporar la creación y el cambio de nombre de reformas, ejecuta después `supabase/migrations/00023_project_management.sql`. Esta migración añade únicamente las funciones `create_project` y `update_project`, conserva todos los datos y solicita a PostgREST que recargue su caché de esquema.

### Activar cuentas, gestión completa y colaboración

Con `00022` y `00023` ya aplicadas, abre Supabase Studio > SQL Editor y ejecuta una sola vez el archivo completo `supabase/migrations/00024_accounts_projects_collaboration.sql`. Hazlo **antes** de desplegar esta versión de la aplicación, porque la nueva interfaz utiliza las funciones creadas por esa migración.

La migración conserva las reformas existentes y las marca como ya configuradas. Añade dirección, descripción, fechas, presupuesto estimado, estado, archivo, duplicado, borrado seguro, roles de colaborador, conversación con menciones, preferencias de correo y registro de actividad. Los avisos de comentarios reutilizan las variables de Mailjet ya configuradas. Los archivos de una reforma se eliminan desde la aplicación antes de borrar sus datos; por eso el borrado debe hacerse desde Ajustes y no directamente desde SQL.

Después reconstruye la aplicación en Coolify. En `/api/health` debe aparecer `release: accounts-projects-collaboration-v1`. Comprueba: recuperar una contraseña; crear una reforma y completar el asistente; editar sus datos; duplicarla; invitar una cuenta como «Solo lectura»; cambiarla a «Puede editar»; modificar una tarea y confirmar que aparece en Actividad. Para probar archivo y borrado deben existir al menos dos reformas activas.

Después de `00024`, ejecuta también `supabase/migrations/00025_fix_home_info_editing.sql`. Sustituye el guardado directo de la ficha de vivienda por funciones con permisos de proyecto explícitos y corrige la edición para propietarios y colaboradores con rol editor. No modifica ni elimina la información existente.

La corrección final del botón de edición elimina completamente el envío HTML automático y renueva la caché de la PWA. Tras el redeploy, `/api/health` debe mostrar `release: home-info-explicit-save-v1`. Si el móvil conserva la versión anterior, cierra NIVEL por completo y vuelve a abrirla una vez con conexión para que el nuevo service worker tome el control.

### Límite gratuito de inteligencia artificial

Después de `00025`, ejecuta una vez `supabase/migrations/00026_ai_usage_limits.sql` y después despliega la aplicación. La migración crea contadores diarios persistentes y atómicos: 5 usos por usuario y 40 para toda la aplicación, reiniciados según la fecha de Europe/Madrid. Si Supabase no permite comprobar o reservar un uso, NIVEL no llama a OpenRouter.

Para usar Groq gratuitamente configura `AI_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL=qwen/qwen3.8-27b` y `AI_FREE_ONLY=true`. Conserva `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=openrouter/free` y `OPENROUTER_PDF_ENGINE=pdf-text` para el respaldo gratuito de PDFs escaneados, demasiado largos para los 8K tokens/minuto de Groq Free o con fallos temporales. El servidor extrae primero el texto localmente y el respaldo no consume un segundo uso interno. Tras el deploy, `/api/health` debe mostrar `release: pdf-vision-v1`, `ai_budget_async: 6`, `provider: groq`, `configured: true` y `free_only: true`.

Si el contador devuelve `AI_USAGE_UNAVAILABLE` después de haber aplicado `00026`, ejecuta `supabase/migrations/00027_fix_ai_usage_counter.sql`. Corrige una ambigüedad de PostgreSQL en `usage_date`, conserva los contadores existentes y recarga el esquema de PostgREST.

### Correos de NIVEL e invitaciones automáticas

En el servicio de la aplicación configura, solo como variables de servidor: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` y `APP_PUBLIC_URL`. Las dos claves de Mailjet nunca deben llevar el prefijo `VITE_`. La URL pública no debe terminar en `/`.

Para sustituir los correos predeterminados de Supabase Auth, añade estas variables al servicio de Supabase, cambiando `https://TU-DOMINIO-NIVEL` por la URL pública real de la aplicación:

```env
MAILER_TEMPLATES_CONFIRMATION=https://TU-DOMINIO-NIVEL/email-templates/confirmation.html
MAILER_TEMPLATES_RECOVERY=https://TU-DOMINIO-NIVEL/email-templates/recovery.html
MAILER_TEMPLATES_MAGIC_LINK=https://TU-DOMINIO-NIVEL/email-templates/magic-link.html
MAILER_TEMPLATES_EMAIL_CHANGE=https://TU-DOMINIO-NIVEL/email-templates/email-change.html
MAILER_TEMPLATES_INVITE=https://TU-DOMINIO-NIVEL/email-templates/invite.html
MAILER_SUBJECTS_CONFIRMATION=Confirma tu cuenta en NIVEL
MAILER_SUBJECTS_RECOVERY=Recupera el acceso a NIVEL
MAILER_SUBJECTS_MAGIC_LINK=Tu enlace para entrar en NIVEL
MAILER_SUBJECTS_EMAIL_CHANGE=Confirma tu nuevo correo en NIVEL
MAILER_SUBJECTS_INVITE=Te han invitado a NIVEL
```

Despliega primero la aplicación para que las URLs de plantilla existan y después reinicia Supabase Auth. Si Auth no puede descargar una plantilla válida, utilizará automáticamente su diseño predeterminado.

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
