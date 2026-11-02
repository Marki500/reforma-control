# Activar CAPTCHA en NIVEL

La aplicación integra Cloudflare Turnstile en registro, acceso, recuperación
y reenvío de confirmación. Los tokens se envían a Supabase y se renuevan después
de cada petición. Sin clave pública configurada, se mantiene el acceso actual.
La protección solo es efectiva cuando también está activada en Supabase Auth.

1. En Cloudflare, abre **Turnstile → Add widget**, pon `NIVEL` como nombre,
   añade el dominio real de la aplicación (sin `https://` ni rutas) y selecciona
   el modo **Managed**. Añade por separado cualquier dominio de pruebas.
2. Copia la **Site key** pública. En el despliegue, añade
   `VITE_TURNSTILE_SITE_KEY=tu-site-key` como variable de compilación.
   Para desarrollo local, añádela al `.env`.
3. Reconstruye y despliega la aplicación. Comprueba que el widget aparece y
   permite completar la verificación antes de activar el requisito en Supabase.
   Cambiar esta variable requiere recompilar: Vite la incorpora al frontend.
4. En Supabase, abre **Authentication → Bot and Abuse Protection**, activa
   CAPTCHA, selecciona **Turnstile**, introduce la **Secret key** y guarda.
   Si Supabase está autoalojado, configura en el servicio Auth/GoTrue:
   `GOTRUE_SECURITY_CAPTCHA_ENABLED=true`,
   `GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile` y
   `GOTRUE_SECURITY_CAPTCHA_SECRET=<secret-key>`, y reinicia ese servicio.
   La clave secreta pertenece exclusivamente a Supabase Auth; nunca a una variable
   `VITE_`, al Dockerfile o al repositorio.
5. Prueba registro y confirmación, acceso, recuperación, reenvío y reintento tras
   un fallo. Comprueba también que una petición directa a Auth sin token CAPTCHA
   es rechazada. Esto confirma que la protección no depende solo del navegador.

Si necesitas revertir, desactiva primero CAPTCHA en Supabase y después retira
la variable pública y vuelve a desplegar, para evitar bloquear el acceso.

Referencias:
- https://supabase.com/docs/guides/auth/auth-captcha
- https://github.com/supabase/auth#configuration
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
