import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { VideoAsset } from "../../../schema";
import type { DocumentaryMediaKind, PreparedDocumentaryMedia } from "../types";
import { getLayerMotion, type MotionPreset } from "../motion";

type DocumentaryMediaLayerProps = {
  readonly asset: VideoAsset;
  readonly media: PreparedDocumentaryMedia;
  readonly durationInFrames: number;
  readonly layerIndex: number;
  readonly preset: MotionPreset;
};

const isGraphicMediaKind = (
  kind: VideoAsset["kind"],
): kind is DocumentaryMediaKind => kind !== "audio";

export const DocumentaryMediaLayer: React.FC<DocumentaryMediaLayerProps> = ({
  asset,
  media,
  durationInFrames,
  layerIndex,
  preset,
}) => {
  if (!isGraphicMediaKind(asset.kind) || asset.kind !== media.kind) {
    throw new Error(
      `Prepared media "${media.id}" does not match document asset "${asset.id}".`,
    );
  }

  const frame = useCurrentFrame();
  const motion = getLayerMotion(preset, frame, durationInFrames, layerIndex);
  const objectPosition = media.focalPoint
    ? `${media.focalPoint.x * 100}% ${media.focalPoint.y * 100}%`
    : "50% 50%";
  const illustration = asset.kind === "illustration";
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: illustration ? "contain" : "cover",
    objectPosition,
    transform: `translate3d(${motion.translateX}px, ${motion.translateY}px, 0) scale(${motion.scale})`,
    opacity: motion.opacity,
  };
  const containerStyle: React.CSSProperties = illustration
    ? {
        inset: "12%",
        overflow: "hidden",
        zIndex: layerIndex,
      }
    : {
        overflow: "hidden",
        zIndex: layerIndex,
      };
  const src = staticFile(media.publicPath);

  return (
    <AbsoluteFill style={containerStyle}>
      {asset.kind === "video" ? (
        <OffthreadVideo
          src={src}
          muted
          durationInFrames={durationInFrames}
          style={mediaStyle}
        />
      ) : (
        <Img src={src} alt={media.altText} style={mediaStyle} />
      )}
    </AbsoluteFill>
  );
};
