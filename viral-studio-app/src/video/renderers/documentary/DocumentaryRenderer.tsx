import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { getTheme } from "../../themes/catalog";
import {
  parseVideoDocument,
  type SceneLayer,
  type VideoAsset,
} from "../../schema";
import { toFrameTimeline } from "../../timeline";
import { DocumentaryMediaLayer } from "./layers/DocumentaryMediaLayer";
import { DocumentaryTextLayer } from "./layers/DocumentaryTextLayer";
import { assertDocumentarySupport } from "./support";
import type { PreparedDocumentary, PreparedDocumentaryMedia } from "./types";

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
}> = ({ vignette, overlayColor }) =>
  vignette > 0 ? (
    <AbsoluteFill
      style={{
        zIndex: 80,
        background: `radial-gradient(ellipse at center, transparent 30%, ${colorWithOpacity(overlayColor, vignette)} 100%)`,
      }}
    />
  ) : null;

export type DocumentaryRendererProps = PreparedDocumentary;

export const DocumentaryRenderer: React.FC<DocumentaryRendererProps> = ({
  document: documentInput,
  media,
}) => {
  const document = useMemo(() => {
    const parsedDocument = parseVideoDocument(documentInput);
    assertDocumentarySupport(parsedDocument);
    return parsedDocument;
  }, [documentInput]);
  const timeline = useMemo(() => toFrameTimeline(document), [document]);
  const composition = useVideoConfig();

  if (
    composition.width !== document.width ||
    composition.height !== document.height ||
    composition.fps !== document.fps ||
    composition.durationInFrames !== timeline.durationInFrames
  ) {
    throw new Error(
      "Documentary renderer composition dimensions, FPS, and duration must match the video document.",
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: getTheme(document.themeId).backgrounds.canvas,
        overflow: "hidden",
      }}
    >
      {timeline.scenes.map((scene) => {
        const theme = getTheme(scene.themeId ?? document.themeId);
        const sceneBackground = scene.layers.some(
          (layer) => layer.type === "image" || layer.type === "video",
        )
          ? theme.backgrounds.overlay
          : theme.backgrounds.canvas;

        return (
          <Sequence
            key={scene.id}
            name={scene.id}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
          >
            <AbsoluteFill
              style={{
                backgroundColor: sceneBackground,
                overflow: "hidden",
              }}
            >
              {scene.layers.map((layer, layerIndex) => {
                if (isMediaLayer(layer)) {
                  const asset = findVideoAsset(document.assets, layer.assetId);
                  const preparedMedia = findPreparedMedia(media, asset.id);

                  return (
                    <DocumentaryMediaLayer
                      key={layer.id}
                      asset={asset}
                      media={preparedMedia}
                      durationInFrames={scene.durationInFrames}
                      layerIndex={layerIndex}
                      preset="documentary"
                    />
                  );
                }

                if (isTextLayer(layer)) {
                  return (
                    <DocumentaryTextLayer
                      key={layer.id}
                      layer={layer}
                      theme={theme}
                      durationInFrames={scene.durationInFrames}
                      layerIndex={layerIndex}
                      preset="documentary"
                    />
                  );
                }

                throw new Error(
                  `Documentary renderer does not support layer type "${layer.type}" in layer "${layer.id}".`,
                );
              })}
              <SceneFinish
                vignette={theme.finishes.vignette}
                overlayColor={theme.backgrounds.overlay}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
