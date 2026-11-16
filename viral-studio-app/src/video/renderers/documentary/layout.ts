import type { SceneLayer } from "../../schema";

type TextLayer = Extract<SceneLayer, { type: "text" }>;
type MediaLayer = Extract<
  SceneLayer,
  { type: "image" | "illustration" | "video" }
>;
type MediaKind = MediaLayer["type"];

const DEFAULT_TEXT_LAYOUT: Record<TextLayer["role"], React.CSSProperties> = {
  headline: {
    bottom: "19%",
    left: "8%",
    right: "8%",
    textAlign: "center",
  },
  body: {
    bottom: "10%",
    left: "9%",
    right: "9%",
    textAlign: "left",
  },
  caption: {
    top: "7%",
    left: "9%",
    right: "9%",
    textAlign: "left",
  },
  quote: {
    top: "35%",
    left: "8%",
    right: "8%",
    textAlign: "center",
  },
  callToAction: {
    bottom: "7%",
    left: "9%",
    right: "9%",
    textAlign: "center",
  },
};

const getFrameStyle = (
  layout: NonNullable<TextLayer["layout"]> | NonNullable<MediaLayer["layout"]>,
): React.CSSProperties => ({
  position: "absolute",
  left: `${layout.x * 100}%`,
  top: `${layout.y * 100}%`,
  right: "auto",
  bottom: "auto",
  width: `${layout.width * 100}%`,
  height: `${layout.height * 100}%`,
});

export const getTextLayerLayout = (layer: TextLayer): React.CSSProperties => {
  if (!layer.layout) {
    return DEFAULT_TEXT_LAYOUT[layer.role];
  }

  return {
    ...getFrameStyle(layer.layout),
    textAlign: layer.layout.align ?? DEFAULT_TEXT_LAYOUT[layer.role].textAlign,
  };
};

export const getMediaLayerLayout = (
  kind: MediaKind,
  layout: MediaLayer["layout"],
): {
  readonly containerStyle: React.CSSProperties;
  readonly objectFit: "cover" | "contain";
} => ({
  containerStyle: layout
    ? getFrameStyle(layout)
    : kind === "illustration"
      ? { inset: "12%" }
      : {},
  objectFit: layout?.fit ?? (kind === "illustration" ? "contain" : "cover"),
});

export const getLayerStackOrder = <Layer extends SceneLayer>(
  layers: readonly Layer[],
) =>
  layers.map((layer, index) => ({
    layer,
    layerIndex: index,
    zIndex: index * 2,
  }));

export const getMediaLayerViewport = (
  kind: MediaKind,
  layout: MediaLayer["layout"],
  composition: { readonly width: number; readonly height: number },
): { readonly width: number; readonly height: number } => {
  const defaultScale = kind === "illustration" ? 0.76 : 1;
  return {
    width: composition.width * (layout?.width ?? defaultScale),
    height: composition.height * (layout?.height ?? defaultScale),
  };
};

export const getSceneFinishZIndex = (layers: readonly SceneLayer[]): number => {
  const lastMediaIndex = layers.reduce(
    (lastIndex, layer, index) =>
      layer.type === "image" ||
      layer.type === "illustration" ||
      layer.type === "video"
        ? index
        : lastIndex,
    -1,
  );

  return lastMediaIndex < 0 ? -1 : lastMediaIndex * 2 + 1;
};
