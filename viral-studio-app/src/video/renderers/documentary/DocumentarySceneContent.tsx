import { AbsoluteFill, Sequence } from "remotion";
import type { SceneLayer, VideoAsset } from "../../schema";
import type { FrameScene } from "../../timeline";
import { getTheme } from "../../themes/catalog";
import { DocumentaryMediaLayer } from "./layers/DocumentaryMediaLayer";
import { DocumentaryTextLayer } from "./layers/DocumentaryTextLayer";
import { getLayerStackOrder, getSceneFinishZIndex } from "./layout";
import type { PreparedDocumentaryMedia } from "./types";

const isTextLayer = (
  layer: SceneLayer,
): layer is Extract<SceneLayer, { type: "text" }> => layer.type === "text";

const isMediaLayer = (
  layer: SceneLayer,
): layer is Extract<SceneLayer, { type: "image" | "illustration" | "video" }> =>
  layer.type === "image" ||
  layer.type === "illustration" ||
  layer.type === "video";

const findVideoAsset = (
  assets: readonly VideoAsset[],
  assetId: string,
): VideoAsset => {
  const asset = assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new Error(`Documentary layer references missing asset "${assetId}".`);
  }

  return asset;
};

const findPreparedMedia = (
  media: readonly PreparedDocumentaryMedia[],
  assetId: string,
): PreparedDocumentaryMedia => {
  const resolved = media.find((candidate) => candidate.id === assetId);
  if (!resolved) {
    throw new Error(
      `Documentary renderer has no safely prepared media for asset "${assetId}".`,
    );
  }

  return resolved;
};

const colorWithOpacity = (hexColor: string, opacity: number): string => {
  const normalized = hexColor.slice(1);
  const shortHex = normalized.length <= 4;
  const channels = shortHex
    ? normalized
        .split("")
        .map((channel) => Number.parseInt(channel + channel, 16))
    : [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
      ];
  const alphaHex = shortHex
    ? normalized[3]
    : normalized.length === 8
      ? normalized.slice(6, 8)
      : undefined;
  const alpha =
    alphaHex === undefined ? 1 : Number.parseInt(alphaHex + alphaHex, 16) / 255;

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity * alpha})`;
};

const SceneFinish: React.FC<{
  readonly vignette: number;
  readonly overlayColor: string;
  readonly zIndex: number;
}> = ({ vignette, overlayColor, zIndex }) =>
  vignette > 0 ? (
    <AbsoluteFill
      style={{
        zIndex,
        background: `radial-gradient(ellipse at center, transparent 30%, ${colorWithOpacity(overlayColor, vignette)} 100%)`,
      }}
    />
  ) : null;

type DocumentarySceneContentProps = {
  readonly scene: FrameScene;
  readonly assets: readonly VideoAsset[];
  readonly media: readonly PreparedDocumentaryMedia[];
  readonly defaultThemeId: string;
};

export const DocumentarySceneContent: React.FC<
  DocumentarySceneContentProps
> = ({ scene, assets, media, defaultThemeId }) => {
  const theme = getTheme(scene.themeId ?? defaultThemeId);
  const sceneBackground = scene.layers.some(
    (layer) => layer.type === "image" || layer.type === "video",
  )
    ? theme.backgrounds.overlay
    : theme.backgrounds.canvas;
  const layerStack = getLayerStackOrder(scene.layers);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: sceneBackground,
        overflow: "hidden",
      }}
    >
      {layerStack.map(({ layer, layerIndex, zIndex }) => {
        if (isMediaLayer(layer)) {
          const asset = findVideoAsset(assets, layer.assetId);
          const preparedMedia = findPreparedMedia(media, asset.id);

          return (
            <Sequence
              key={layer.id}
              name={layer.id}
              from={layer.frameTiming.from}
              durationInFrames={layer.frameTiming.durationInFrames}
            >
              <DocumentaryMediaLayer
                asset={asset}
                kind={layer.type}
                layout={layer.layout}
                motion={layer.motion}
                frameTiming={layer.frameTiming}
                media={preparedMedia}
                layerIndex={layerIndex}
                zIndex={zIndex}
                preset="documentary"
              />
            </Sequence>
          );
        }

        if (isTextLayer(layer)) {
          return (
            <Sequence
              key={layer.id}
              name={layer.id}
              from={layer.frameTiming.from}
              durationInFrames={layer.frameTiming.durationInFrames}
            >
              <DocumentaryTextLayer
                layer={layer}
                theme={theme}
                frameTiming={layer.frameTiming}
                layerIndex={layerIndex}
                zIndex={zIndex}
                preset="documentary"
              />
            </Sequence>
          );
        }

        throw new Error(
          `Documentary renderer does not support layer type "${layer.type}" in layer "${layer.id}".`,
        );
      })}
      <SceneFinish
        vignette={theme.finishes.vignette}
        overlayColor={theme.backgrounds.overlay}
        zIndex={getSceneFinishZIndex(scene.layers)}
      />
    </AbsoluteFill>
  );
};
