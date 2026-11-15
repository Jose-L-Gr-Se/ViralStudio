import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneLayer } from "../../../schema";
import type { VisualTheme } from "../../../themes/schema";
import { getLayerMotion, type MotionPreset } from "../motion";

type TextLayer = Extract<SceneLayer, { type: "text" }>;

type DocumentaryTextLayerProps = {
  readonly layer: TextLayer;
  readonly theme: VisualTheme;
  readonly durationInFrames: number;
  readonly layerIndex: number;
  readonly preset: MotionPreset;
};

const TEXT_LAYOUT: Record<TextLayer["role"], React.CSSProperties> = {
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
  durationInFrames,
  layerIndex,
  preset,
}) => {
  const frame = useCurrentFrame();
  const motion = getLayerMotion(preset, frame, durationInFrames, layerIndex);
  const typography = getTypography(layer.role, theme);

  return (
    <AbsoluteFill style={{ zIndex: 100 + layerIndex }}>
      <div
        style={{
          position: "absolute",
          ...TEXT_LAYOUT[layer.role],
          fontFamily: typography.font.family,
          fontSize: typography.fontSize,
          fontWeight: typography.font.weight,
          letterSpacing: typography.font.letterSpacing,
          lineHeight: layer.role === "quote" ? 1.02 : 1.12,
          color: typography.color,
          textShadow: getTextShadow(theme),
          opacity: motion.opacity,
          transform: `translate3d(${motion.translateX * 0.35}px, ${motion.translateY * 0.35}px, 0) scale(${1 + (motion.scale - 1) * 0.35})`,
          transformOrigin: "center",
        }}
      >
        {layer.text}
      </div>
    </AbsoluteFill>
  );
};
