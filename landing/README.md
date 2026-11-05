# NIVEL landing

Landing independiente para https://reforma.noxumlab.com.
Aplicación: https://app-reforma.noxumlab.com.

## Coolify

Repositorio: el mismo de la app. Rama: landing-production.
Build strategy: Dockerfile. Base directory: /. Dockerfile: /landing/Dockerfile.
Puerto del contenedor: 80. Healthcheck: /healthz.
No requiere variables de entorno, claves ni conexión a Supabase.

## Compatibilidad

nginx.conf redirige los antiguos enlaces de la aplicación a la nueva URL, conservando ruta y parámetros. auth-redirect.js preserva en el navegador los fragmentos de confirmación antiguos. sw.js retira el antiguo service worker de la app en el dominio de la landing.

## Verificación

node --test landing/tests/auth-redirect.test.mjs

Las pantallas son capturas reales de NIVEL con datos ficticios. La fotografía es conceptual, generada con ImageGen. Prompt y licencia de tipografía en ASSETS.md y dist/assets/fonts/OFL.txt.