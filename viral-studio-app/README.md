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
