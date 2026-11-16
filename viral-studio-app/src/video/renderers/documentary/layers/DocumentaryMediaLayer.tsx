import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SceneLayer, VideoAsset } from "../../../schema";
import type { FrameLayerTiming } from "../../../timeline";
import type { DocumentaryMediaKind, PreparedDocumentaryMedia } from "../types";
import { getMediaLayerLayout, getMediaLayerViewport } from "../layout";
import {
  combineLayerMotion,
  getLayerAnimation,
  getLayerMotion,
  getMediaMotion,
  type MotionPreset,
} from "../motion";

type DocumentaryMediaLayerSchema = Extract<
  SceneLayer,
  { type: "image" | "illustration" | "video" }
>;

type DocumentaryMediaLayerProps = {
  readonly asset: VideoAsset;
  readonly kind: DocumentaryMediaLayerSchema["type"];
  readonly layout: DocumentaryMediaLayerSchema["layout"];
  readonly motion: DocumentaryMediaLayerSchema["motion"];
  readonly frameTiming: FrameLayerTiming;
  readonly media: PreparedDocumentaryMedia;
  readonly layerIndex: number;
  readonly zIndex: number;
  readonly preset: MotionPreset;
};

const isGraphicMediaKind = (
  kind: VideoAsset["kind"],
): kind is DocumentaryMediaKind => kind !== "audio";

export const DocumentaryMediaLayer: React.FC<DocumentaryMediaLayerProps> = ({
  asset,
  kind,
  layout,
  motion: layerMotion,
  frameTiming,
  media,
  layerIndex,
  zIndex,
  preset,
}) => {
  if (!isGraphicMediaKind(asset.kind) || asset.kind !== media.kind) {
    throw new Error(
      `Prepared media "${media.id}" does not match document asset "${asset.id}".`,
    );
  }

  const frame = useCurrentFrame();
  const composition = useVideoConfig();
  const objectPosition = media.focalPoint
    ? `${media.focalPoint.x * 100}% ${media.focalPoint.y * 100}%`
    : "50% 50%";
  const mediaLayout = getMediaLayerLayout(kind, layout);
  const viewport = getMediaLayerViewport(kind, layout, composition);
  const movement = layerMotion
    ? getMediaMotion(
        layerMotion.preset,
        frame,
        frameTiming.durationInFrames,
        layerMotion.intensity ?? 0.5,
        viewport,
      )
    : getLayerMotion(preset, frame, frameTiming.durationInFrames, layerIndex);
  const animation = getLayerAnimation(
    frame,
    frameTiming,
    viewport.height * 0.02,
  );
  const composedMotion = combineLayerMotion(movement, animation);
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: mediaLayout.objectFit,
    objectPosition,
    transform: `translate3d(${composedMotion.translateX}px, ${composedMotion.translateY}px, 0) scale(${composedMotion.scale})`,
    transformOrigin: "center",
    opacity: composedMotion.opacity,
  };
  const containerStyle: React.CSSProperties = {
    ...mediaLayout.containerStyle,
    overflow: "hidden",
    zIndex,
  };
  const src = staticFile(media.publicPath);

  return (
    <AbsoluteFill style={containerStyle}>
      {asset.kind === "video" ? (
        <OffthreadVideo
          src={src}
          muted
          durationInFrames={frameTiming.durationInFrames}
          style={mediaStyle}
        />
      ) : (
        <Img src={src} alt={media.altText} style={mediaStyle} />
      )}
    </AbsoluteFill>
  );
};
