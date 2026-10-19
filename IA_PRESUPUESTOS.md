# IA para presupuestos y facturas

La aplicación analiza documentos en segundo plano y presenta un borrador editable.
Solo se guardan los datos tras la revisión del usuario. Las claves permanecen en el servidor.

## Lectura de PDF

El servidor extrae el texto de cada página con `pdf-parse`. No envía al modelo los
metadatos Author/Creator ni utiliza el nombre del archivo como prueba del proveedor.
Si alguna página tiene menos de 80 letras o números, convierte todas las páginas
a PNG y utiliza visión. Esto cubre PDF escaneados y documentos mixtos.

Si la extracción textual no reconoce el documento o no devuelve datos económicos,
se realiza un único reintento visual. Una respuesta sin clasificación correcta o
sin importes positivos en total, base o partidas termina como extracción incompleta,
con aviso y opción de rellenar manualmente. No se presenta como borrador válido.
Los datos obtenidos siguen necesitando revisión humana.

Límites: 80 páginas y 120.000 caracteres para texto; 8 páginas y 12 MB de PNG para
visión. Las imágenes se preparan con un máximo de 1800 × 2600 píxeles por página.
Si se supera un límite, se rechaza el análisis completo con un aviso: no se analiza
solo una parte del documento. Se mantiene el límite de subida para IA de 14 MB.

## Proveedores

```env
AI_PROVIDER=groq
AI_FREE_ONLY=true
GROQ_API_KEY=...
GROQ_MODEL=qwen/qwen3.8-27b
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

Groq recibe texto extraído localmente. Los documentos que necesitan visión pasan
a OpenRouter; si Groq devuelve una extracción vacía, el respaldo fuerza visión.
Sin respaldo configurado, se muestra un aviso y queda disponible el formulario manual.
También se puede usar directamente `AI_PROVIDER=openrouter`, o `AI_PROVIDER=gemini`
con `GEMINI_API_KEY` y `AI_FREE_ONLY=false` si se acepta ese proveedor.

OpenRouter recibe texto o imágenes PNG, sin adjunto PDF ni plugin de extracción.
No se activa un servicio OCR de pago. `OPENROUTER_PDF_ENGINE=pdf-text` puede conservarse
por compatibilidad de configuración; ya no determina la lectura del PDF.
Los límites gratuitos del proveedor siguen aplicándose. Un reintento comparte
la reserva de uso interna, aunque implica otra petición al proveedor.

## Despliegue y validación

Reconstruir y desplegar servidor y frontend. Esta corrección no añade migraciones.
`/api/health` identifica `release: pdf-vision-v1`, `ai_pdf_vision: 1`,
`ai_extraction_validation: 1`, `ai_budget_async: 6` y `ai_invoice_async: 1`.
El contenedor incluye la utilidad de validación compartida por cliente y servidor.

Ejecutar `node --test tests/*.test.mjs` y `npm run build`.
Las pruebas usan PDF sintéticos y proveedores simulados: cubren texto, escaneos,
documentos mixtos, límites, reintento visual, rechazo de respuestas vacías y cupo.
No envían documentos reales ni comprueban la precisión de un modelo remoto.

Referencias: [imágenes en OpenRouter](https://openrouter.ai/docs/guides/overview/multimodal/overview)
y [comprensión de imágenes en Gemini](https://ai.google.dev/gemini-api/docs/image-understanding).
