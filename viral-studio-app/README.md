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

## Temas y recursos locales

El catálogo tipado de temas está en `src/video/themes/catalog.ts`:
`forest-editorial`, `cinematic-dark`, `scientific` y `natural-product`.
Los temas solo contienen tokens de color, tipografía, escala, espaciado,
radios, fondos y acabados; no fijan la composición ni el layout de las escenas.
Las tipografías usan familias locales del sistema, sin descargas externas.

Los recursos multimedia se registran en `src/video/media/manifest.ts`. El
manifiesto está vacío inicialmente porque aún no hay archivos multimedia en
el proyecto. Añade recursos a `public/media/` y registra para cada uno su ID,
tipo, ruta relativa, procedencia, licencia, créditos y texto alternativo.
Imágenes e ilustraciones pueden incluir un punto focal normalizado entre 0 y 1.
La ruta, tipo y ID declarados en un vídeo deben coincidir con el manifiesto.

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
saliente se mantiene congelada durante la transición; la entrante conserva su
frame 0, geometría, movimiento y timing. `dissolve` mezcla por opacidad;
`wipe` revela mediante recorte dentro del lienzo y `fade` pasa por el fondo
del tema entrante.
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
