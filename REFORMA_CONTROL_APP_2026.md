# Reforma Control App 2026

## 1. Objetivo del proyecto

Crear una aplicación web privada para controlar la reforma de una casa.

La app debe permitir organizar y consultar toda la información importante relacionada con la reforma: materiales, presupuestos, facturas, proveedores, pagos, tareas, decisiones pendientes e inspiración visual.

La primera versión debe centrarse en la gestión de materiales, ya que actualmente el proyecto está en la fase de buscar productos por internet, comparar precios, guardar enlaces, imágenes, medidas y notas.

La aplicación debe estar pensada para uso personal, pero con una estructura modular para poder ampliarse en el futuro.

---

## 2. Nombre provisional

**Reforma Control App**

Otros posibles nombres internos:

- Casa Control
- Obra Control
- Reforma Planner
- Home Reform Dashboard
- Materiales Reforma

---

## 3. Stack tecnológico recomendado

La app debe desarrollarse con:

- React
- Vite
- Supabase
- Supabase Auth
- Supabase Storage
- Tailwind CSS

La aplicación debe estar preparada para crecer por módulos.

---

## 4. Funcionalidades de la primera versión MVP

La primera versión debe incluir:

- Login privado con Supabase Auth.
- Dashboard inicial.
- CRUD completo de materiales.
- Vista de materiales en tarjetas.
- Vista de materiales en tabla.
- Filtros por categoría, estancia, estado y prioridad.
- Buscador por nombre, marca, modelo o tienda.
- Cálculo del total económico de materiales guardados.
- Subida de imágenes a Supabase Storage.
- Posibilidad de guardar enlaces de productos.
- Posibilidad de guardar notas internas.
- Importación de materiales desde una URL de producto.
- Diseño limpio, moderno, responsive y fácil de usar desde ordenador y móvil.

---

## 5. Módulo principal: Materiales

Cada material debe tener los siguientes campos:

- ID
- Nombre
- Marca
- Modelo
- Categoría
- Estancia
- Precio
- Moneda
- Tienda
- Enlace del producto
- Imagen principal
- Imágenes adicionales
- Medidas
- Descripción corta
- Estado
- Prioridad
- Disponibilidad
- Notas
- Fecha de creación
- Fecha de última actualización

---

## 6. Categorías iniciales de materiales

Categorías recomendadas:

- Suelo
- Baño
- Cocina
- Iluminación
- Pintura
- Muebles
- Electrodomésticos
- Carpintería
- Decoración
- Sanitarios
- Grifería
- Revestimientos
- Climatización
- Puertas
- Ventanas
- Herrajes
- Otros

---

## 7. Estancias iniciales

Estancias recomendadas:

- Cocina
- Baño principal
- Baño secundario
- Salón
- Comedor
- Habitación principal
- Habitación secundaria
- Despacho
- Pasillo
- Entrada
- Terraza
- Exterior
- General

---

## 8. Estados posibles de un material

Estados recomendados:

- Mirando
- Favorito
- Pendiente de decidir
- Descartado
- Comprado
- Recibido
- Devuelto

---

## 9. Prioridades posibles

Prioridades recomendadas:

- Baja
- Media
- Alta
- Urgente

---

# 10. Diseño visual general: tendencia 2026

La app debe tener una estética actual, alineada con tendencias UI/UX de 2026, pero sin perder claridad ni utilidad.

No debe parecer una hoja de cálculo ni un panel administrativo genérico.

Debe sentirse como una herramienta privada, visual, cálida y muy cuidada para tomar decisiones sobre una reforma.

## 10.1 Dirección estética recomendada

La app debe combinar:

- Minimalismo cálido.
- Diseño editorial.
- Dashboard visual.
- Tarjetas limpias.
- Jerarquía clara.
- Microinteracciones suaves.
- Espaciado generoso.
- Estética premium, pero práctica.
- Inspiración de apps SaaS modernas, dashboards de diseño y moodboards de interiorismo.

## 10.2 Personalidad visual

La interfaz debe transmitir:

- Orden.
- Calma.
- Control.
- Claridad.
- Confianza.
- Gusto visual.
- Sensación de proyecto bien organizado.

Debe evitar:

- Aspecto frío de ERP.
- Tablas grises sin personalidad.
- Colores demasiado saturados.
- Demasiadas sombras.
- Demasiadas líneas.
- Interfaces recargadas.
- Cards con aspecto antiguo.
- Diseño genérico tipo plantilla básica.

---

# 11. Tendencias UI/UX 2026 que debe revisar antes de diseñar

La IA o desarrollador que construya la app debe revisar tendencias de diseño UI/UX de 2026 antes de definir la interfaz definitiva.

Debe tener en cuenta especialmente:

## 11.1 Dashboards más inteligentes y menos estáticos

El dashboard no debe limitarse a mostrar números.

Debe ayudar a decidir.

Ejemplos:

- Avisar de materiales favoritos todavía no comprados.
- Mostrar decisiones pendientes.
- Mostrar materiales de prioridad alta.
- Mostrar desviaciones de presupuesto.
- Mostrar comparativas por estancia.
- Mostrar los últimos enlaces guardados.

## 11.2 Interfaz orientada a acciones

Cada pantalla debe facilitar la siguiente acción.

Ejemplos:

- Añadir material.
- Importar desde URL.
- Comparar opciones.
- Marcar como favorito.
- Descartar.
- Comprar.
- Adjuntar factura.
- Asociar material a una estancia.

## 11.3 Diseño mobile-first

La app debe funcionar muy bien en móvil, porque durante una reforma se consultarán materiales, fotos y presupuestos desde tiendas, obra o reuniones.

En móvil debe priorizar:

- Botón rápido para añadir material.
- Botón rápido para importar desde URL.
- Cards visuales.
- Filtros fáciles.
- Buscador visible.
- Acciones claras.
- Formularios sencillos.

## 11.4 Cards visuales como elemento principal

Las tarjetas deben ser el elemento principal para materiales e inspiración.

Cada card debe tener:

- Imagen protagonista.
- Nombre claro.
- Precio visible.
- Tienda.
- Estado.
- Prioridad.
- Estancia.
- Acciones rápidas.

## 11.5 Diseño editorial

La app puede usar detalles de diseño editorial:

- Títulos con personalidad.
- Secciones bien separadas.
- Jerarquía tipográfica clara.
- Bloques visuales tipo revista/interiorismo.
- Espacios blancos generosos.
- Imágenes cuidadas.

## 11.6 Microinteracciones suaves

Añadir microinteracciones discretas:

- Hover suave en cards.
- Animación ligera al cambiar estado.
- Feedback visual al guardar.
- Skeleton loaders.
- Transiciones suaves en modales.
- Confirmaciones elegantes, no intrusivas.

Evitar animaciones excesivas o decorativas que ralenticen la app.

## 11.7 IA como ayuda, no como protagonista

Si se añade IA en el futuro, debe aparecer como ayuda contextual.

Ejemplos:

- Resumir este presupuesto.
- Comparar estas 3 opciones.
- Detectar posibles costes ocultos.
- Clasificar este material.
- Extraer datos de una factura.
- Sugerir categoría y estancia.

La IA no debe dominar la interfaz.

## 11.8 Personalización

La app debe permitir en el futuro personalizar:

- Nombre del proyecto.
- Estilo visual de la reforma.
- Presupuesto objetivo.
- Estancias.
- Categorías.
- Estados.
- Prioridades.

## 11.9 Modo claro y modo oscuro

La app debería contemplar modo claro y modo oscuro.

Modo claro:

- Fondo cálido.
- Tarjetas blancas o marfil.
- Bordes suaves.
- Contraste limpio.

Modo oscuro:

- Fondo carbón.
- Cards oscuras elevadas.
- Tonos cálidos para acentos.
- Buena legibilidad.

## 11.10 Accesibilidad

Aunque la app sea privada, debe ser accesible:

- Buen contraste.
- Tamaños de letra legibles.
- Estados de foco visibles.
- Botones claros.
- Labels en formularios.
- No depender solo del color para comunicar estados.
- Navegación cómoda desde teclado.

---

# 12. Guía visual recomendada

## 12.1 Paleta de color sugerida

La app debe usar una paleta cálida y elegante, inspirada en materiales de interiorismo.

Colores sugeridos:

- Fondo principal: marfil cálido o gris piedra muy claro.
- Cards: blanco cálido.
- Texto principal: carbón.
- Texto secundario: gris topo.
- Acento principal: verde oliva suave, terracota, arcilla o azul petróleo.
- Estados:
  - Favorito: dorado suave.
  - Comprado: verde.
  - Descartado: gris.
  - Urgente: terracota/rojo suave.
  - Pendiente: ámbar.

No usar una paleta demasiado tecnológica tipo azul eléctrico si no encaja con la sensación de hogar/reforma.

## 12.2 Tipografía

La tipografía debe ser moderna, legible y con personalidad.

Recomendación:

- Sans serif elegante para interfaz.
- Posible combinación con una serif editorial para títulos grandes, si queda bien.

Ejemplos de estilo:

- Inter
- Satoshi
- Manrope
- Geist
- Plus Jakarta Sans
- DM Sans

Para títulos más editoriales:

- Playfair Display
- Cormorant Garamond
- Fraunces

La prioridad debe ser legibilidad y claridad.

## 12.3 Bordes, radios y sombras

- Cards con border-radius medio/alto.
- Botones redondeados, pero no infantiles.
- Inputs limpios.
- Bordes muy suaves.
- Separadores sutiles.
- Sombras suaves, casi imperceptibles.
- Evitar sombras fuertes o muy negras.

## 12.4 Iconografía

Usar iconos lineales y sencillos.

Ejemplos:

- Home
- Search
- Filter
- Plus
- Link
- Upload
- Receipt
- FileText
- Check
- Heart
- Trash
- Edit
- ExternalLink

---

# 13. Layout general recomendado

## 13.1 Desktop

Estructura recomendada:

- Sidebar lateral.
- Header superior con buscador y acciones rápidas.
- Área principal con dashboard/cards.
- Botón destacado para Añadir material.
- Botón secundario para Importar desde URL.

Sidebar:

- Dashboard
- Materiales
- Presupuestos
- Facturas
- Proveedores
- Tareas
- Inspiración
- Decisiones
- Ajustes

## 13.2 Mobile

Estructura recomendada:

- Header compacto.
- Navegación inferior o menú hamburguesa.
- Botón flotante para añadir/importar material.
- Cards apiladas.
- Filtros en modal o drawer inferior.

---

# 14. Diseño de la vista de materiales

La vista principal de materiales debe mostrar tarjetas visuales.

Cada tarjeta debe incluir:

- Imagen del material.
- Nombre.
- Marca/modelo si existe.
- Categoría.
- Estancia.
- Precio.
- Tienda.
- Estado.
- Prioridad.
- Botón para ver producto.
- Botón para editar.
- Botón para eliminar.

Ejemplo visual de una tarjeta:

```txt
[Imagen]

Grifo negro mate
Marca · Modelo
Baño principal · Grifería

79,90 €
Leroy Merlin

Estado: Favorito
Prioridad: Alta

[Ver producto] [Editar]
```

## 14.1 Diseño recomendado para la card

La card debe tener:

- Imagen superior con proporción estable.
- Badge de estado sobre la imagen.
- Precio destacado.
- Tienda como dato secundario.
- Acciones al final.
- Hover con ligera elevación.
- Menú de acciones secundarias si hace falta.

---

# 15. Vista en tabla

Además de la vista en tarjetas, debe existir una vista en tabla para comparar materiales de forma más rápida.

Columnas recomendadas:

- Imagen miniatura.
- Nombre.
- Categoría.
- Estancia.
- Tienda.
- Precio.
- Estado.
- Prioridad.
- Fecha de creación.
- Acciones.

La tabla debe ser limpia, con suficiente espacio y no demasiado densa.

En móvil, la tabla puede sustituirse por cards compactas.

---

# 16. Comparador de materiales

La app debe contemplar un comparador de materiales.

Funcionalidad futura:

- Seleccionar 2, 3 o más materiales.
- Comparar precio, tienda, medidas, estado, notas y enlace.
- Ver ventajas/inconvenientes.
- Marcar una opción ganadora.
- Guardar decisión.

Ejemplo:

```txt
Comparativa: Grifería baño principal

Opción 1 — 79,90 € — Leroy Merlin — Favorito
Opción 2 — 119,00 € — Amazon — Pendiente
Opción 3 — 98,00 € — Bauhaus — Descartado
```

---

# 17. Filtros y buscador

La pantalla de materiales debe incluir:

- Buscador por nombre, marca, modelo o tienda.
- Filtro por categoría.
- Filtro por estancia.
- Filtro por estado.
- Filtro por prioridad.
- Ordenación por precio.
- Ordenación por fecha de creación.
- Ordenación por última actualización.

Los filtros deben ser visuales y fáciles de resetear.

Debe existir un botón:

**Limpiar filtros**

---

# 18. Dashboard inicial

El dashboard debe mostrar:

- Total de materiales guardados.
- Total económico estimado.
- Número de materiales favoritos.
- Número de materiales comprados.
- Número de materiales descartados.
- Materiales pendientes de decidir.
- Últimos materiales añadidos.
- Materiales con prioridad alta.
- Total por estancia.
- Total por categoría.

## 18.1 Diseño del dashboard

El dashboard debe ser visual y accionable.

Debe incluir:

- Cards de métricas.
- Bloque de Próximas decisiones.
- Bloque de Materiales favoritos pendientes.
- Bloque de Últimos materiales añadidos.
- Gráfico sencillo de coste por estancia.
- Gráfico sencillo de coste por categoría.

No debe parecer un dashboard financiero frío.

Debe sentirse como un panel de control de una reforma real.

---

# 19. Función importante: importar material desde URL

La app debe incluir una función para crear materiales automáticamente a partir de una URL de producto.

En el formulario de materiales debe existir una opción llamada:

**Importar desde URL**

El flujo debe ser:

1. El usuario pega una URL de producto.
2. La app envía esa URL a una función backend.
3. El backend intenta leer la página.
4. El sistema intenta extraer datos automáticamente.
5. La app muestra una pantalla de revisión.
6. El usuario puede corregir o completar los datos.
7. El usuario confirma y guarda el material.

La app no debe guardar el material automáticamente sin revisión previa.

---

# 20. Datos a extraer desde una URL

Cuando el usuario pegue una URL, la app debe intentar extraer:

- Nombre del producto.
- Marca.
- Modelo.
- Precio.
- Moneda.
- Imagen principal.
- Tienda.
- Descripción corta.
- URL original.
- Disponibilidad.
- Categoría sugerida.
- Estancia sugerida si es posible.

Si algún dato no se puede extraer, el campo debe quedar vacío para poder rellenarlo manualmente.

---

# 21. Fuentes de extracción de datos

El backend debe intentar obtener la información desde:

- JSON-LD / schema.org.
- Open Graph tags.
- Meta tags.
- Título de la página.
- HTML visible.
- Datos estructurados de producto.
- Imágenes principales definidas en la página.

Prioridad recomendada:

1. JSON-LD Product.
2. Open Graph.
3. Meta tags.
4. HTML visible.
5. Título de la página.

---

# 22. Limitaciones de la importación desde URL

La función de importar desde URL puede fallar o ser parcial en algunos casos.

Posibles problemas:

- Tiendas que bloquean scraping.
- Webs que cargan precios con JavaScript.
- Productos con variantes.
- Precios con descuento temporal.
- Gastos de envío no incluidos.
- Amazon u otras plataformas con protección anti-bots.
- Imágenes protegidas o cargadas dinámicamente.

Por eso, la app debe permitir siempre la edición manual antes de guardar.

---

# 23. Backend recomendado para importar desde URL

Para esta función se puede usar una de estas opciones:

## Opción 1: Supabase Edge Functions

Buena opción si se quiere mantener todo dentro de Supabase.

Ventajas:

- Menos infraestructura.
- Integrado con Supabase.
- Suficiente para extraer Open Graph y JSON-LD.

## Opción 2: Node.js + Express

Buena opción si se quiere más control.

Ventajas:

- Más flexible.
- Permite usar librerías de scraping.
- Más fácil de ampliar.

## Opción 3: Node.js + Playwright

Opción más potente para webs que cargan contenido con JavaScript.

Ventajas:

- Puede renderizar páginas.
- Puede acceder a contenido generado dinámicamente.

Inconvenientes:

- Más pesado.
- Más lento.
- Requiere más recursos.

Para la primera versión, se recomienda empezar con JSON-LD + Open Graph mediante Supabase Edge Functions o Node.js sencillo.

---

# 24. Formulario de revisión tras importar URL

Después de importar una URL, la app debe mostrar un formulario editable con los datos detectados.

Campos editables:

- Nombre.
- Marca.
- Modelo.
- Precio.
- Tienda.
- Imagen.
- Categoría.
- Estancia.
- Estado.
- Prioridad.
- Descripción.
- Notas.

Botones:

- Guardar material.
- Cancelar.
- Reintentar extracción.
- Limpiar campos.

---

# 25. Módulos futuros

La app debe estar preparada para añadir estos módulos más adelante:

- Presupuestos.
- Facturas.
- Proveedores.
- Pagos.
- Tareas.
- Decisiones pendientes.
- Inspiración visual.
- Fotos del antes, durante y después.
- Comparador de materiales.
- Exportación a PDF.
- Análisis de presupuestos con IA.
- Control de desviaciones de presupuesto.
- Calendario de obra.
- Timeline de reforma.

---

# 26. Módulo futuro: Presupuestos

Cada presupuesto debe tener:

- Proveedor.
- Tipo de trabajo.
- Estancia relacionada.
- Importe.
- IVA incluido.
- Fecha de recepción.
- Fecha de validez.
- Estado.
- Archivo PDF.
- Notas.
- Partidas principales.

Estados posibles:

- Pedido.
- Recibido.
- En revisión.
- Aceptado.
- Descartado.
- Pendiente de respuesta.

---

# 27. Módulo futuro: Facturas y pagos

Cada factura o pago debe tener:

- Concepto.
- Proveedor.
- Importe.
- Fecha.
- Método de pago.
- Estado.
- Archivo adjunto.
- Notas.

Estados posibles:

- Pendiente.
- Pagado.
- Parcial.
- Reclamado.

---

# 28. Módulo futuro: Proveedores

Cada proveedor debe tener:

- Nombre.
- Empresa.
- Tipo de profesional.
- Teléfono.
- Email.
- Web.
- Dirección.
- Estado.
- Valoración.
- Notas.

Tipos de proveedor:

- Albañil.
- Electricista.
- Fontanero.
- Carpintero.
- Pintor.
- Interiorista.
- Tienda de materiales.
- Arquitecto.
- Arquitecto técnico.
- Otro.

---

# 29. Módulo futuro: Tareas

Cada tarea debe tener:

- Título.
- Descripción.
- Estancia.
- Responsable.
- Fecha límite.
- Estado.
- Prioridad.
- Notas.

Estados posibles:

- No empezada.
- En proceso.
- Bloqueada.
- Terminada.
- Cancelada.

---

# 30. Módulo futuro: Decisiones pendientes

Cada decisión pendiente debe tener:

- Título.
- Descripción.
- Estancia.
- Opciones relacionadas.
- Fecha límite.
- Estado.
- Decisión final.
- Notas.

Ejemplos:

- Elegir suelo del salón.
- Decidir grifería del baño.
- Confirmar distribución de cocina.
- Elegir color de pintura.
- Decidir modelo de puertas.

---

# 31. Módulo futuro: Inspiración visual

La app debe permitir guardar referencias visuales.

Cada inspiración debe tener:

- Imagen.
- Título.
- Fuente.
- URL.
- Estancia relacionada.
- Categoría.
- Notas.
- Etiquetas.

Ejemplos de etiquetas:

- Minimalista.
- Cálido.
- Mediterráneo.
- Industrial.
- Madera.
- Piedra.
- Blanco.
- Negro.
- Beige.
- Verde.

---

# 32. Tablas previstas en la base de datos

La base de datos debe poder crecer con estas tablas:

```txt
projects
rooms
materials
material_categories
suppliers
quotes
invoices
payments
tasks
files
decisions
inspiration
```

Para el MVP inicial, las tablas imprescindibles son:

```txt
materials
rooms
material_categories
```

---

# 33. Esquema inicial sugerido: materials

Campos sugeridos:

```txt
id
user_id
name
brand
model
category_id
room_id
price
currency
store_name
product_url
main_image_url
description
measurements
status
priority
availability
notes
created_at
updated_at
```

---

# 34. Esquema inicial sugerido: rooms

Campos sugeridos:

```txt
id
user_id
name
description
created_at
updated_at
```

---

# 35. Esquema inicial sugerido: material_categories

Campos sugeridos:

```txt
id
user_id
name
description
created_at
updated_at
```

---

# 36. Seguridad y privacidad

La app debe ser privada.

Requisitos:

- Login obligatorio.
- Cada usuario solo puede ver sus propios datos.
- Usar Row Level Security en Supabase.
- Proteger las imágenes y archivos si es necesario.
- No exponer claves privadas en el frontend.
- Usar variables de entorno.

---

# 37. Requisitos de diseño

La interfaz debe ser:

- Limpia.
- Moderna.
- Visual.
- Responsive.
- Fácil de usar.
- Con tarjetas claras.
- Con filtros visibles.
- Con botones bien diferenciados.
- Con buena jerarquía visual.
- Con una estética cuidada, pero sin sobrecargar.
- Inspirada en tendencias UI/UX de 2026.
- Adaptada al universo de hogar, reforma, materiales e interiorismo.

La app debe sentirse como un panel privado de control de una reforma, no como una hoja de cálculo.

---

# 38. Estructura recomendada del proyecto

```txt
src/
  components/
    layout/
      AppLayout.jsx
      Sidebar.jsx
      Header.jsx
    materials/
      MaterialCard.jsx
      MaterialForm.jsx
      MaterialsTable.jsx
      MaterialsFilters.jsx
      ImportFromUrlModal.jsx
    dashboard/
      DashboardStats.jsx
      RecentMaterials.jsx
    ui/
      Button.jsx
      Input.jsx
      Select.jsx
      Modal.jsx
      Badge.jsx
  pages/
    Login.jsx
    Dashboard.jsx
    Materials.jsx
  services/
    supabaseClient.js
    materialsService.js
    importUrlService.js
  hooks/
    useMaterials.js
    useAuth.js
  utils/
    formatCurrency.js
    extractDomain.js
  App.jsx
  main.jsx
```

---

# 39. Variables de entorno

Crear un archivo `.env.example` con:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Si se usa backend propio:

```txt
VITE_API_URL=
```

---

# 40. Primera tarea de desarrollo

Crear la primera versión funcional de la app con:

1. Configuración inicial de React + Vite.
2. Instalación de Tailwind CSS.
3. Configuración de Supabase.
4. Login privado.
5. Dashboard básico.
6. Módulo de materiales con CRUD completo.
7. Subida de imágenes.
8. Filtros y buscador.
9. Vista en tarjetas.
10. Vista en tabla.
11. Importación básica desde URL usando JSON-LD y Open Graph.
12. Formulario de revisión antes de guardar.
13. Primera propuesta visual basada en tendencias UI/UX 2026.

---

# 41. Prompt para la IA de desarrollo

Quiero que desarrolles una aplicación web privada llamada Reforma Control App.

Debe estar hecha con React, Vite, Supabase y Tailwind CSS.

La primera versión MVP debe centrarse en la gestión de materiales para una reforma de una casa.

Antes de generar la interfaz, revisa tendencias UI/UX de 2026 para dashboards, SaaS apps, web apps privadas, mobile-first design y apps con IA contextual.

La app no debe parecer una hoja de cálculo ni un panel administrativo genérico.

Debe tener una estética moderna, cálida, visual y cuidada, relacionada con el universo de hogar, reforma, interiorismo y materiales.

Necesito que generes:

- La estructura completa del proyecto.
- Los componentes principales.
- La configuración de Supabase.
- El SQL para crear las tablas necesarias.
- El sistema de login.
- El CRUD completo de materiales.
- La subida de imágenes a Supabase Storage.
- Los filtros por categoría, estancia, estado y prioridad.
- Un buscador por nombre, marca, modelo o tienda.
- Un dashboard básico con totales.
- Una vista en tarjetas.
- Una vista en tabla.
- Una función para importar materiales desde una URL.
- La función de importar URL debe intentar extraer nombre, marca, modelo, precio, imagen principal, tienda, descripción, disponibilidad y URL original.
- La extracción debe hacerse desde backend o función server-side, no directamente desde el navegador.
- La app debe mostrar siempre una pantalla de revisión antes de guardar los datos importados.
- El diseño debe ser moderno, limpio, responsive, visual y alineado con tendencias 2026.

La app debe estar preparada para añadir después módulos de presupuestos, facturas, proveedores, pagos, tareas, inspiración visual y análisis con IA.

---

# 42. Prompt específico para la función de importar URL

Crea una función llamada `importProductFromUrl`.

Objetivo:

Permitir que el usuario pegue una URL de producto y que la app intente extraer automáticamente la información principal del producto.

La función debe:

1. Recibir una URL.
2. Validar que la URL sea válida.
3. Hacer una petición server-side a la página.
4. Analizar el HTML recibido.
5. Buscar datos en JSON-LD con tipo Product.
6. Buscar datos en Open Graph.
7. Buscar datos en meta tags.
8. Devolver un objeto normalizado.

El objeto devuelto debe tener esta estructura:

```js
{
  name: "",
  brand: "",
  model: "",
  price: null,
  currency: "EUR",
  image: "",
  storeName: "",
  productUrl: "",
  description: "",
  availability: "",
  rawData: {}
}
```

La función debe contemplar errores y devolver mensajes claros si no se puede extraer información.

La app debe permitir editar todos los campos antes de guardar el material.

---

# 43. Prompt específico para diseño visual 2026

Diseña la interfaz de Reforma Control App siguiendo tendencias UI/UX de 2026.

La app debe sentirse como una herramienta premium, visual y práctica para controlar una reforma de casa.

Requisitos visuales:

- Diseño mobile-first.
- Dashboard accionable.
- Cards visuales para materiales.
- Estética cálida y editorial.
- Paleta inspirada en hogar, piedra, madera, arcilla, oliva y tonos neutros.
- Microinteracciones suaves.
- Modo claro preparado.
- Modo oscuro preparado.
- Botones claros.
- Inputs elegantes.
- Formularios fáciles.
- Filtros visuales.
- Buen contraste.
- Nada de estética de hoja Excel.
- Nada de panel administrativo genérico.
- Nada de diseño frío tipo ERP.

El dashboard debe ayudar a tomar decisiones, no solo mostrar datos.

Debe incluir:

- Cards de resumen.
- Coste estimado.
- Coste por estancia.
- Materiales pendientes.
- Favoritos.
- Prioridades altas.
- Últimos materiales añadidos.
- Acceso rápido a importar desde URL.

La vista de materiales debe ser muy visual, con cards cuidadas y una vista alternativa en tabla.

---

# 44. Referencias de tendencias 2026 que debe revisar la IA/desarrollador

Antes de definir la interfaz final, revisar referencias actuales sobre:

- Web design trends 2026.
- UI design trends 2026.
- Dashboard design trends 2026.
- SaaS dashboard inspiration 2026.
- Interior design trends 2026.
- Color trends 2026.
- Mobile-first dashboards.
- AI-assisted interfaces.

Ideas que debe tener presentes:

- 3D e inmersión solo si aporta valor, no como decoración gratuita.
- Dark mode bien resuelto.
- Motion design suave.
- Personalización.
- Interfaces con IA contextual.
- Dashboards menos estáticos y más accionables.
- Diseño cálido y expresivo.
- Uso de color más humano y menos corporativo.
- Menos ruido visual y más foco en decisiones.

---

# 45. Notas de enfoque

No es necesario que la app sea perfecta en la primera versión.

La prioridad es que sea útil rápidamente para guardar materiales, comparar precios y no perder enlaces.

El primer objetivo real es sustituir una hoja de cálculo, notas sueltas, capturas de pantalla y enlaces guardados en WhatsApp.

La app debe ahorrar tiempo y ayudar a tomar decisiones durante la reforma.

La estética importa porque la app se usará para tomar decisiones visuales relacionadas con una casa, materiales, acabados e interiorismo.
