import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayer } from "../../../schema";
import type { FrameLayerTiming } from "../../../timeline";
import type { VisualTheme } from "../../../themes/schema";
import { getTextLayerLayout } from "../layout";
import {
  combineLayerMotion,
  getLayerAnimation,
  getLayerMotion,
  type MotionPreset,
} from "../motion";

type TextLayer = Extract<SceneLayer, { type: "text" }>;

type DocumentaryTextLayerProps = {
  readonly layer: TextLayer;
  readonly theme: VisualTheme;
  readonly frameTiming: FrameLayerTiming;
  readonly layerIndex: number;
  readonly zIndex: number;
  readonly preset: MotionPreset;
};

const getTypography = (role: TextLayer["role"], theme: VisualTheme) => {
  switch (role) {
    case "headline":
      return {
        font: theme.typography.headline,
        fontSize: theme.typeScale.headline,
        color: theme.colors.cream,
      };
    case "body":
      return {
        font: theme.typography.body,
        fontSize: theme.typeScale.body,
        color: theme.colors.cream,
      };
    case "caption":
      return {
        font: theme.typography.caption,
        fontSize: theme.typeScale.caption,
        color: theme.colors.accentSecondary,
      };
    case "quote":
      return {
        font: theme.typography.display,
        fontSize: theme.typeScale.display,
        color: theme.colors.cream,
      };
    case "callToAction":
      return {
        font: theme.typography.headline,
        fontSize: theme.typeScale.title,
        color: theme.colors.accent,
      };
  }
};

const getTextShadow = (theme: VisualTheme): string => {
  switch (theme.finishes.shadow) {
    case "none":
      return "none";
    case "soft":
      return "0 2px 18px rgba(0, 0, 0, 0.32)";
    case "cinematic":
      return "0 3px 28px rgba(0, 0, 0, 0.62)";
  }
};

export const DocumentaryTextLayer: React.FC<DocumentaryTextLayerProps> = ({
  layer,
  theme,
  frameTiming,
  layerIndex,
  zIndex,
  preset,
}) => {
  const frame = useCurrentFrame();
  const composition = useVideoConfig();
  const legacyMotion = getLayerMotion(
    preset,
    frame,
    frameTiming.durationInFrames,
    layerIndex,
  );
  const movement = {
    scale: 1 + (legacyMotion.scale - 1) * 0.35,
    translateX: legacyMotion.translateX * 0.35,
    translateY: legacyMotion.translateY * 0.35,
  };
  const animation = getLayerAnimation(
    frame,
    frameTiming,
    composition.height * 0.015,
  );
  const motion = combineLayerMotion(movement, animation);
  const typography = getTypography(layer.role, theme);

  return (
    <AbsoluteFill style={{ zIndex }}>
      <div
        style={{
          position: "absolute",
          ...getTextLayerLayout(layer),
          fontFamily: typography.font.family,
          fontSize: typography.fontSize,
          fontWeight: typography.font.weight,
          letterSpacing: typography.font.letterSpacing,
          lineHeight: layer.role === "quote" ? 1.02 : 1.12,
          color: typography.color,
          textShadow: getTextShadow(theme),
          opacity: motion.opacity,
          transform: `translate3d(${motion.translateX}px, ${motion.translateY}px, 0) scale(${motion.scale})`,
          transformOrigin: "center",
        }}
      >
        {layer.text}
      </div>
    </AbsoluteFill>
  );
};
