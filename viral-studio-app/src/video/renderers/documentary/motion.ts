import { Easing, interpolate } from "remotion";
import type {
  FrameLayerAnimation,
  FrameLayerTiming,
  LayerAnimationPreset,
} from "../../timeline";

export type MotionPreset = "documentary";
export type MediaMotionPreset =
  | "static"
  | "push-in"
  | "pull-out"
  | "pan-left"
  | "pan-right";

export type LayerTransform = {
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
};

export type LayerMotion = LayerTransform & {
  readonly opacity: number;
};

export type LayerAnimation = LayerMotion;

type MotionFunction = (
  frame: number,
  durationInFrames: number,
  variation: number,
) => LayerMotion;

const getLegacyFadeFrames = (durationInFrames: number): number =>
  Math.min(15, Math.floor(durationInFrames / 3));

const getLegacyFadeIn = (frame: number, durationInFrames: number): number => {
  const fadeFrames = getLegacyFadeFrames(durationInFrames);
  return fadeFrames === 0
    ? 1
    : interpolate(frame, [0, fadeFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
};

const getLegacyFadeOut = (frame: number, durationInFrames: number): number => {
  const fadeFrames = getLegacyFadeFrames(durationInFrames);
  return fadeFrames === 0
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
};

const getProgress = (frame: number, durationInFrames: number): number =>
  durationInFrames <= 1
    ? 0
    : interpolate(frame, [0, durationInFrames - 1], [0, 1], {
        easing: Easing.inOut(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

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
  const horizontalDirection = variation % 2 === 0 ? -1 : 1;
  const verticalDirection = variation % 4 < 2 ? -1 : 1;
  const pan = interpolate(progress, [0, 1], [-10, 10]);

  return {
    opacity:
      getLegacyFadeIn(frame, durationInFrames) *
      getLegacyFadeOut(frame, durationInFrames),
    scale: interpolate(progress, [0, 1], [1.035, 1.12]),
    translateX: pan * horizontalDirection,
    translateY: pan * verticalDirection * 0.55,
  };
};

const MOTION_PRESETS = {
  documentary: getDocumentaryMotion,
} satisfies Record<MotionPreset, MotionFunction>;

const assertMotionFrame = (frame: number, durationInFrames: number): void => {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError("Motion frame must be a non-negative integer.");
  }

  if (!Number.isSafeInteger(durationInFrames) || durationInFrames <= 0) {
    throw new RangeError("Motion duration must be a positive integer.");
  }
};

const assertIntensity = (intensity: number): void => {
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) {
    throw new RangeError("Motion intensity must be between 0 and 1.");
  }
};

export const getLayerMotion = (
  preset: MotionPreset,
  frame: number,
  durationInFrames: number,
  variation = 0,
): LayerMotion => {
  assertMotionFrame(frame, durationInFrames);
  return MOTION_PRESETS[preset](frame, durationInFrames, variation);
};

export const getMediaMotion = (
  preset: MediaMotionPreset,
  frame: number,
  durationInFrames: number,
  intensity: number,
  viewport: { readonly width: number; readonly height: number },
): LayerTransform => {
  assertMotionFrame(frame, durationInFrames);
  assertIntensity(intensity);

  if (
    !Number.isFinite(viewport.width) ||
    viewport.width <= 0 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= 0
  ) {
    throw new RangeError("Motion viewport dimensions must be positive.");
  }

  const progress = getProgress(frame, durationInFrames);
  const zoom = 0.06 * intensity;

  switch (preset) {
    case "static":
      return { scale: 1, translateX: 0, translateY: 0 };
    case "push-in":
      return {
        scale: interpolate(progress, [0, 1], [1, 1 + zoom]),
        translateX: 0,
        translateY: 0,
      };
    case "pull-out":
      return {
        scale: interpolate(progress, [0, 1], [1 + zoom, 1]),
        translateX: 0,
        translateY: 0,
      };
    case "pan-left":
    case "pan-right": {
      const scale = 1 + 0.05 * intensity;
      const safeTravel = (scale - 1) * viewport.width * 0.5 * 0.8;
      const direction = preset === "pan-left" ? 1 : -1;

      return {
        scale,
        translateX: interpolate(
          progress,
          [0, 1],
          [safeTravel * direction, -safeTravel * direction],
        ),
        translateY: 0,
      };
    }
  }
};

const getAnimationProgress = (
  frame: number,
  durationInFrames: number,
  animation: FrameLayerAnimation,
  edge: "enter" | "exit",
): number => {
  if (animation.legacy) {
    return edge === "enter"
      ? getLegacyFadeIn(frame, durationInFrames)
      : 1 - getLegacyFadeOut(frame, durationInFrames);
  }

  if (animation.durationInFrames < 2) {
    throw new RangeError("Configured layer animations must span two frames.");
  }

  const from =
    edge === "enter" ? 0 : durationInFrames - animation.durationInFrames;
  return getProgress(frame - from, animation.durationInFrames);
};

const getAnimationTransform = (
  preset: LayerAnimationPreset,
  progress: number,
  edge: "enter" | "exit",
  riseDistance: number,
): LayerAnimation => {
  const entering = edge === "enter";

  switch (preset) {
    case "fade":
      return {
        opacity: entering ? progress : 1 - progress,
        scale: 1,
        translateX: 0,
        translateY: 0,
      };
    case "rise":
      return {
        opacity: entering ? progress : 1 - progress,
        scale: 1,
        translateX: 0,
        translateY: entering
          ? riseDistance * (1 - progress)
          : -riseDistance * progress,
      };
    case "scale":
      return {
        opacity: entering ? progress : 1 - progress,
        scale: entering ? 0.96 + 0.04 * progress : 1 - 0.04 * progress,
        translateX: 0,
        translateY: 0,
      };
  }
};

export const getLayerAnimation = (
  frame: number,
  timing: FrameLayerTiming,
  riseDistance: number,
): LayerAnimation => {
  assertMotionFrame(frame, timing.durationInFrames);

  if (!Number.isFinite(riseDistance) || riseDistance < 0) {
    throw new RangeError("Layer rise distance must be non-negative.");
  }

  const enterProgress = getAnimationProgress(
    frame,
    timing.durationInFrames,
    timing.enter,
    "enter",
  );
  const exitProgress = getAnimationProgress(
    frame,
    timing.durationInFrames,
    timing.exit,
    "exit",
  );
  const enter = getAnimationTransform(
    timing.enter.preset,
    enterProgress,
    "enter",
    riseDistance,
  );
  const exit = getAnimationTransform(
    timing.exit.preset,
    exitProgress,
    "exit",
    riseDistance,
  );

  return {
    opacity: enter.opacity * exit.opacity,
    scale: enter.scale * exit.scale,
    translateX: enter.translateX + exit.translateX,
    translateY: enter.translateY + exit.translateY,
  };
};

export const combineLayerMotion = (
  movement: LayerTransform,
  animation: LayerAnimation,
): LayerMotion => ({
  opacity: animation.opacity,
  scale: movement.scale * animation.scale,
  translateX: movement.translateX + animation.translateX,
  translateY: movement.translateY + animation.translateY,
});
