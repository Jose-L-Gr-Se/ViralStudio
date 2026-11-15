import { parseVideoDocument } from "../../schema";
import { toFrameTimeline } from "../../timeline";
import type { PreparedDocumentary } from "./types";

const previewDocument = parseVideoDocument({
  schemaVersion: 1,
  id: "documentary-preview",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 9,
  themeId: "forest-editorial",
  assets: [],
  scenes: [
    {
      id: "preview-opening",
      timing: { startSeconds: 0, durationSeconds: 3 },
      format: "documentary",
      layers: [
        {
          id: "preview-opening-caption",
          type: "text",
          role: "caption",
          text: "VIRAL STUDIO",
        },
        {
          id: "preview-opening-headline",
          type: "text",
          role: "headline",
          text: "Historias con intención.",
        },
      ],
    },
    {
      id: "preview-middle",
      timing: { startSeconds: 3, durationSeconds: 3 },
      format: "documentary",
      themeId: "cinematic-dark",
      layers: [
        {
          id: "preview-middle-quote",
          type: "text",
          role: "quote",
          text: "El movimiento acompaña la idea.",
        },
      ],
    },
    {
      id: "preview-close",
      timing: { startSeconds: 6, durationSeconds: 3 },
      format: "documentary",
      themeId: "natural-product",
      layers: [
        {
          id: "preview-close-caption",
          type: "text",
          role: "body",
          text: "Un renderer. Muchas formas de contar.",
        },
        {
          id: "preview-close-call-to-action",
          type: "text",
          role: "callToAction",
          text: "Diseñemos la siguiente escena.",
        },
      ],
    },
  ],
});

export const DOCUMENTARY_PREVIEW: PreparedDocumentary = {
  document: previewDocument,
  media: [],
};

export const DOCUMENTARY_PREVIEW_DURATION_IN_FRAMES =
  toFrameTimeline(previewDocument).durationInFrames;
