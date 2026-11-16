# Viral Studio

Proyecto de vídeo con Remotion. La composición vertical `ViralVertical` está
registrada en Remotion Studio dentro de la carpeta **Vertical**. Las
composiciones de ejemplo originales se mantienen disponibles.

## Comandos

Desde `viral-studio-app/`:

```console
npm run dev
```

Para exportar la composición vertical a MP4:

```console
npm run render:vertical
```

El archivo se genera en `out/viral-studio-vertical.mp4` con resolución
1080x1920, 30 fps y duración de 15 segundos.

## Render documental desde JSON

Los documentos JSON de vídeo se guardan en `videos/`. El comando valida el
documento, prepara los recursos locales registrados y renderiza mediante el
renderer documental reutilizable:

```console
npm run video:render -- --input videos/mi-video.json
```

La salida predeterminada es `out/videos/<id-del-documento>.mp4`. Se puede
seleccionar otra ruta con `--output ruta/video.mp4`. Si el archivo ya existe,
el render se rechaza; `--overwrite` solo reemplaza el destino después de que
FFprobe confirme códec, dimensiones, FPS, duración y fotogramas del temporal.
Las rutas de entrada y salida relativas se resuelven desde `viral-studio-app/`.
El comando requiere FFmpeg y FFprobe instalados localmente.

## Temas y recursos locales

El catálogo tipado de temas está en `src/video/themes/catalog.ts`:
`forest-editorial`, `cinematic-dark`, `scientific` y `natural-product`.
Los temas solo contienen tokens de color, tipografía, escala, espaciado,
radios, fondos y acabados; no fijan la composición ni el layout de las escenas.
Las tipografías usan familias locales del sistema, sin descargas externas.

Los recursos multimedia se registran en `src/video/media/manifest.ts`. Añade
recursos a `public/media/` y registra para cada uno su ID, tipo, ruta relativa,
procedencia, licencia, créditos y texto alternativo. Imágenes e ilustraciones
pueden incluir un punto focal normalizado entre 0 y 1. La ruta, tipo y ID
declarados en un vídeo deben coincidir con el manifiesto.

La prueba C.1.4 registra tres fotografías documentales locales en
`public/media/documentary-proof/`. Las páginas fuente de Wikimedia Commons y
los metadatos de autoría/licencia están anotados por recurso en el manifiesto;
las tres son fotografías oficiales del USDA en dominio público. El render de
la prueba no accede a servicios externos.

Extensiones permitidas:

- Imagen: `.avif`, `.jpeg`, `.jpg`, `.png`, `.webp`
- Ilustración: `.png`, `.svg`, `.webp`
- Vídeo: `.mp4`, `.webm`
- Audio: `.aac`, `.m4a`, `.mp3`, `.ogg`, `.wav`

El resolver acepta solo rutas relativas dentro de `public/media/`, comprueba
la existencia del archivo y rechaza traversal, rutas absolutas, URLs remotas,
extensiones incompatibles y symlinks que salgan de esa carpeta.

## Layout de capas documentales

Las capas documentales de texto, imagen, ilustración y vídeo pueden declarar
un `layout` opcional con `x`, `y`, `width` y `height` normalizados respecto al
lienzo. Sin `allowCrop: true`, la caja debe quedar dentro de `0..1` en ambos
ejes. El recorte explícito permite coordenadas entre `-1..1` y dimensiones
mayores que cero y hasta `2`; el lienzo recorta el contenido que sobresale.

El texto admite `align: "left" | "center" | "right"`. Los medios admiten
`fit: "cover" | "contain"`. Si se omite `layout`, se conservan las posiciones
por rol del texto, el encuadre a pantalla completa de imágenes y vídeos y el
inset actual de las ilustraciones. El orden de `layers` determina el
apilamiento: la primera capa queda detrás de las siguientes.

## Movimiento y timing documental

Las capas de imagen, ilustración y vídeo admiten `motion` con los presets
`static`, `push-in`, `pull-out`, `pan-left` y `pan-right`. La intensidad
opcional se expresa entre `0` y `1` y vale `0.5` si se omite. Sin `motion`, se
mantiene el movimiento documental anterior; `static` desactiva solo ese
movimiento, no los fundidos.

Las capas visuales admiten `timing` relativo a la escena. `startSeconds`
comienza en `0` por defecto y `durationSeconds`, si se omite, ocupa hasta el
final de la escena. `enter` y `exit` pueden usar `fade`, `rise` o `scale`, con
duración en segundos. Si se omiten, se conservan los fundidos predeterminados.
Los límites se validan en fotogramas: la capa debe tener al menos un fotograma
visible y las animaciones deben dejar fotogramas visibles entre ambas.

## Transiciones documentales entre escenas

Una escena puede declarar `transitionIn` para definir cómo entra desde la
escena documental consecutiva anterior:

```json
{
  "transitionIn": {
    "type": "dissolve",
    "durationSeconds": 0.6
  }
}
```

Los tipos son `cut`, `dissolve`, `fade` y `wipe`. Si se omite el campo, se
mantiene el corte actual. `cut` no necesita duración; las transiciones
visuales requieren `durationSeconds`. Su conversión y duración efectiva se
calculan en fotogramas por el timeline, limitadas por la longitud de ambas
escenas adyacentes. Cada transición visual requiere al menos tres fotogramas
efectivos para que el cambio aparezca en el render y no se convierta en un
corte.

La transición ocupa los primeros fotogramas de la escena entrante sin mover ni
solapar los intervalos de escena ni cambiar la duración del vídeo. La escena
saliente se congela en el último fotograma en que el medio aún está plenamente
visible, respetando su movimiento y timing; así, el fundido local no deja una
imagen vacía detrás de la transición. La entrante conserva su frame 0,
geometría, movimiento y timing. `dissolve` mezcla por opacidad, `wipe` revela
mediante recorte dentro del lienzo y `fade` pasa por el fondo del tema entrante.
La primera escena no admite transición visual de entrada; las transiciones no
pueden cruzar huecos entre escenas.

## Pruebas

```console
npm test
npm run test:phase-b
```

La integración audiovisual real se ejecuta por separado para que `npm test` no
dependa de FFmpeg. Requiere `ffmpeg` y `ffprobe` instalados localmente; genera
una imagen sintética PNG, la valida con el manifiesto y renderer documental, y
guarda un MP4 H.264 único en `out/tests/`.

```console
npm run test:integration
```

La prueba audiovisual completa C.1.4 es independiente de `npm test` y del
render de integración corto. Genera un MP4 H.264 de 24 segundos, verifica el
conteo de fotogramas con FFprobe y conserva fotogramas de las escenas y
transiciones, además de una hoja de contacto, bajo una carpeta única en
`out/tests/`.

```console
npm run test:documentary-proof
```

Las pruebas del comando se ejecutan por separado de `npm test`. La prueba CLI
no renderiza; la integración real requiere FFmpeg y FFprobe locales y verifica
un documento distinto del fixture C.1.4:

```console
npm run test:video-render-cli
npm run test:video-render
```
