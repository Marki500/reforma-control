# Propuesta de IA para presupuestos

Esta integración todavía no está implementada. Tareas es la primera pieza para poder convertir un presupuesto en acciones útiles.

## Flujo propuesto

1. Seleccionar un presupuesto PDF ya subido.
2. Extraer su texto. Si es un escaneo sin texto, necesitará OCR.
3. Mostrar un resumen: partidas, cantidades, importes, impuestos y condiciones. Los datos ausentes se indican como desconocidos.
4. Proponer materiales y tareas en una lista editable, vinculando cada propuesta a su página o fragmento original.
5. El usuario marca qué quiere añadir y confirma. La IA no modifica la app por sí sola.

Hay que conservar la diferencia entre precio unitario y total de partida, separar IVA y evitar convertir automáticamente servicios/mano de obra en materiales. Los importes se validan mediante código; un resumen no es una comprobación contable.

## Primera prueba gratuita en Ubuntu

Ollama con un modelo local pequeño permite probar sin pagar una API. Sigue habiendo consumo de electricidad, CPU, RAM y disco. Con unos 8 GB compartidos con Supabase y Coolify no podemos prometer capacidad ni velocidad sin medirlo.

Antes de instalar, ejecutar en el VPS:

```bash
free -h
lscpu
df -h
docker stats --no-stream
```

Si hay memoria suficiente, probar un modelo pequeño como `qwen2.5:1.5b` con presupuestos ficticios cortos. Es una prueba de viabilidad, no una garantía de precisión. Comparar manualmente importes, omisiones y tiempo de respuesta. Documentación: https://docs.ollama.com/linux y https://ollama.com/library/qwen2.5:1.5b.

La instalación y configuración del VPS se harán después de revisar esos datos. Si el VPS va justo de memoria, ejecutar Ollama en otro ordenador y conectarlo por una red privada como Tailscale. No publicar la API de Ollama en Internet. Para uso local, se puede desactivar el modo cloud con `OLLAMA_NO_CLOUD=1`.

## Integración cuando la prueba funcione

El backend de la app hablará con Ollama por una URL interna configurada en runtime, nunca directamente desde el navegador. En Docker, localhost significa el propio contenedor: hay que configurar la red y dirección del servicio correctamente.

El endpoint verificará sesión y propiedad del presupuesto; limitará páginas, tamaño y tiempo; tratará todo el texto del PDF como datos, nunca como instrucciones; pedirá una respuesta estructurada y validará su esquema. La selección confirmada se guardará con protección frente a duplicados y errores parciales.

Primero probar PDFs con texto. Después añadir OCR para escaneos, y por último la selección para crear materiales/tareas. No subir presupuestos reales a servicios externos sin elegir previamente proveedor y condiciones de uso.

Referencia sobre ejecución local y memoria: https://docs.ollama.com/faq.
