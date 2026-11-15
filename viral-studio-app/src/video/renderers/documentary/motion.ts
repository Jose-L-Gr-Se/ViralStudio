import { Easing, interpolate } from "remotion";

export type MotionPreset = "documentary";

export type LayerMotion = {
  readonly opacity: number;
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
};

type MotionFunction = (
  frame: number,
  durationInFrames: number,
  variation: number,
) => LayerMotion;

const getDocumentaryMotion: MotionFunction = (
  frame,
  durationInFrames,
  variation,
) => {
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [0, 1],
    {
      easing: Easing.inOut(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const fadeFrames = Math.min(15, Math.floor(durationInFrames / 3));
  const fadeIn =
    fadeFrames === 0
      ? 1
      : interpolate(frame, [0, fadeFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const fadeOut =
    fadeFrames === 0
      ? 1
      : interpolate(
          frame,
          [durationInFrames - 1 - fadeFrames, durationInFrames - 1],
          [1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
  const horizontalDirection = variation % 2 === 0 ? -1 : 1;
  const verticalDirection = variation % 4 < 2 ? -1 : 1;
  const pan = interpolate(progress, [0, 1], [-10, 10]);

  return {
    opacity: Math.min(fadeIn, fadeOut),
    scale: interpolate(progress, [0, 1], [1.035, 1.12]),
    translateX: pan * horizontalDirection,
    translateY: pan * verticalDirection * 0.55,
  };
};

const MOTION_PRESETS = {
  documentary: getDocumentaryMotion,
} satisfies Record<MotionPreset, MotionFunction>;

export const getLayerMotion = (
  preset: MotionPreset,
  frame: number,
  durationInFrames: number,
  variation = 0,
): LayerMotion => {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError("Motion frame must be a non-negative integer.");
  }

  if (!Number.isSafeInteger(durationInFrames) || durationInFrames <= 0) {
    throw new RangeError("Motion duration must be a positive integer.");
  }

  return MOTION_PRESETS[preset](frame, durationInFrames, variation);
};
