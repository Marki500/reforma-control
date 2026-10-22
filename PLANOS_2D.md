# Editor de planos 2D

En **Planos**, elige **Crear plano 2D** para empezar en blanco o **Probar con un ejemplo** para abrir una distribución editable de 24 m². Las imágenes subidas anteriormente siguen disponibles.

## Activación

Antes de desplegar, ejecuta una vez en Supabase Studio → SQL Editor:

`supabase/migrations/00033_interactive_floor_plans.sql`

Añade `floor_plans.plan_data` y conserva las políticas de acceso del proyecto. No modifica imágenes ni planos existentes. El script antiguo `npm run migrate` no incluye esta migración.

Sin la migración puedes dibujar y exportar, pero guardar mostrará un aviso. No se ha aplicado a producción desde este entorno.

## Uso

- **Habitación:** marca dos esquinas opuestas para crear cuatro paredes.
- **Pared:** marca puntos sucesivos. Puedes comenzar o terminar exactamente en un extremo, una intersección o en mitad de otra pared. El indicador verde confirma el ajuste y su alcance se adapta al zoom. Esc, clic derecho o **Terminar trazo** terminan la cadena. Los espacios cerrados se reconocen automáticamente; un tabique entre paredes puede dividir una habitación.
- **Puerta / Ventana:** pulsa sobre una pared con espacio libre. Selecciona la abertura para ajustar ancho y posición, o arrástrala por su pared. Las puertas permiten cambiar el lado de apertura.
- **Seleccionar:** pulsa una pared para modificar longitud, grosor o altura. Arrastrarla mueve también los extremos conectados. Pulsa una habitación para nombrarla y vincularla a una estancia existente.
- **Mover vista:** arrastra el lienzo. También puedes mantener Ctrl/Cmd o espacio y arrastrar, o usar el botón central del ratón, sin cambiar de herramienta ni mover una pared. El espacio se activa con el foco en el lienzo. La rueda amplía o reduce alrededor del cursor y los controles inferiores permiten acercar, alejar y centrar.
- **Móvil:** un dedo selecciona, dibuja mediante toques o arrastra un elemento. Dos dedos desplazan el plano y pellizcar ajusta el zoom. La primera pulsación táctil espera a soltarse antes de colocar un punto: añadir un segundo dedo cancela cualquier arrastre de objeto en curso y no crea paredes. Tras levantar uno de los dedos, se espera a que ambos se hayan levantado antes de permitir dibujar otra vez.
- **Deshacer / Rehacer:** disponibles en la barra. Ctrl/Cmd + Z deshace; Ctrl/Cmd + Shift + Z rehace. Supr elimina la pared o abertura seleccionada. Ctrl/Cmd + S guarda cuando el foco está en el lienzo.
- **Guardar:** conserva la distribución en el proyecto. Si otra persona la ha guardado desde que la abriste, la actualización se rechaza: exporta tu copia y vuelve a abrir el plano.
- **Exportar / Importar:** copia JSON editable de hasta 1 MB. Importar sustituye el dibujo después de confirmarlo y se puede deshacer.

El borrador sin guardar se conserva en la sesión del navegador, separado por usuario, proyecto y plano. No sustituye el guardado en el proyecto: cerrar la sesión del navegador puede borrarlo. Volver al editor permite recuperarlo si la versión guardada no ha cambiado.

## Alcance

Unidades en metros y cuadrícula de dibujo de 10 cm. La superficie se calcula entre ejes de pared y es aproximada; los recintos interiores no se cuentan dos veces. Máximo: 200 paredes, 200 aberturas y 200 habitaciones por plano.

El editor trabaja en 2D y guarda grosor y altura para una futura vista de volumen. No genera 3D ni convierte una imagen en paredes. En móvil se puede consultar y editar mediante toques; las propiedades aparecen debajo del lienzo.

## Validación

`node --test tests/floor-plan.test.mjs`

`node --test tests/plan-navigation.test.mjs tests/plan-gestures.test.mjs`

Las pruebas de gestos ejecutan los manejadores reales del editor con eventos simulados, incluyendo Ctrl, dos dedos, la interrupción de un arrastre por un segundo dedo y las pulsaciones canceladas. La sensación táctil debe comprobarse también en un teléfono real.

`npm run build`

Vista local sin datos reales: `node node_modules/vite/bin/vite.js --config tests/ui-preview.config.mjs`, ruta `/planos`. Sus guardados utilizan datos ficticios de la sesión, no Supabase. Añade `?saveError=1` para probar un fallo de guardado. La persistencia real y los permisos RLS deben verificarse tras aplicar la migración a Supabase.
