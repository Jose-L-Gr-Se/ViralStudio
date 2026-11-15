import { getTheme } from "../../themes/catalog";
import type { SceneLayer, VideoDocument } from "../../schema";

const isSupportedLayer = (
  layer: SceneLayer,
): layer is Extract<
  SceneLayer,
  { type: "text" | "image" | "illustration" | "video" }
> =>
  layer.type === "text" ||
  layer.type === "image" ||
  layer.type === "illustration" ||
  layer.type === "video";

export const assertDocumentarySupport = (document: VideoDocument): void => {
  getTheme(document.themeId);

  for (const scene of document.scenes) {
    if (scene.format !== "documentary") {
      throw new Error(
        `Documentary renderer does not support scene format "${scene.format}" in scene "${scene.id}".`,
      );
    }

    getTheme(scene.themeId ?? document.themeId);

    for (const layer of scene.layers) {
      if (!isSupportedLayer(layer)) {
        throw new Error(
          `Documentary renderer does not support layer type "${layer.type}" in layer "${layer.id}".`,
        );
      }
    }
  }

  for (const asset of document.assets) {
    if (asset.kind === "audio") {
      throw new Error(
        `Documentary renderer does not support audio asset "${asset.id}".`,
      );
    }
  }
};
