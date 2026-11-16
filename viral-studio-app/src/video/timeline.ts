import type { SceneLayer, VideoDocument } from "./schema";

export type LayerAnimationPreset = "fade" | "rise" | "scale";

type LayerAnimationInput = {
  readonly preset: LayerAnimationPreset;
  readonly durationSeconds: number;
};

export type SceneTransitionInput =
  | { readonly type: "cut" }
  | {
      readonly type: "dissolve" | "fade" | "wipe";
      readonly durationSeconds: number;
    };

export type FrameSceneTransition = {
  readonly type: SceneTransitionInput["type"];
  readonly durationInFrames: number;
};

export type LayerTimingInput = {
  readonly startSeconds?: number;
  readonly durationSeconds?: number;
  readonly enter?: LayerAnimationInput;
  readonly exit?: LayerAnimationInput;
};

export type FrameLayerAnimation = {
  readonly preset: LayerAnimationPreset;
  readonly durationInFrames: number;
  readonly legacy: boolean;
};

export type FrameLayerTiming = {
  readonly from: number;
  readonly durationInFrames: number;
  readonly enter: FrameLayerAnimation;
  readonly exit: FrameLayerAnimation;
};

export type FrameLayer = SceneLayer & {
  readonly frameTiming: FrameLayerTiming;
};

export type FrameScene = Omit<
  VideoDocument["scenes"][number],
  "layers" | "transitionIn"
> & {
  readonly from: number;
  readonly durationInFrames: number;
  readonly transitionSourceFrame: number;
  readonly transitionIn: FrameSceneTransition;
  readonly layers: readonly FrameLayer[];
};

export type FrameTimeline = {
  readonly durationInFrames: number;
  readonly scenes: readonly FrameScene[];
};

export const secondsToFrames = (seconds: number, fps: number): number => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError("Seconds must be a finite, non-negative number.");
  }

  if (!Number.isSafeInteger(fps) || fps <= 0) {
    throw new RangeError("FPS must be a positive integer.");
  }

  const frames = Math.round(seconds * fps);
  if (!Number.isSafeInteger(frames)) {
    throw new RangeError("Frame count exceeds the safe integer range.");
  }

  return frames;
};

export const isAtLeastOneFrameLong = (seconds: number, fps: number): boolean =>
  Number.isFinite(seconds) &&
  seconds >= 0 &&
  Number.isSafeInteger(fps) &&
  fps > 0 &&
  seconds * fps >= 1 - Number.EPSILON * 8;

export const getSceneTransitionTiming = (
  transition: SceneTransitionInput | undefined,
  previousDurationInFrames: number,
  currentDurationInFrames: number,
  fps: number,
): FrameSceneTransition => {
  if (!transition || transition.type === "cut") {
    return { type: "cut", durationInFrames: 0 };
  }

  if (
    !Number.isSafeInteger(previousDurationInFrames) ||
    previousDurationInFrames <= 0 ||
    !Number.isSafeInteger(currentDurationInFrames) ||
    currentDurationInFrames <= 0
  ) {
    throw new RangeError("Transition scenes must have positive frame lengths.");
  }

  const requestedDurationInFrames = secondsToFrames(
    transition.durationSeconds,
    fps,
  );
  const durationInFrames = Math.min(
    requestedDurationInFrames,
    previousDurationInFrames,
    currentDurationInFrames,
  );
  const minimumDurationInFrames = 3;

  if (
    requestedDurationInFrames < minimumDurationInFrames ||
    durationInFrames < minimumDurationInFrames
  ) {
    throw new RangeError(
      `A ${transition.type} transition requires at least ${minimumDurationInFrames} available frames.`,
    );
  }

  return { type: transition.type, durationInFrames };
};

const legacyFadeFrames = (durationInFrames: number): number =>
  Math.min(15, Math.floor(Math.max(0, durationInFrames) / 3));

const getTransitionSourceFrame = (
  sceneDurationInFrames: number,
  layers: readonly FrameLayer[],
): number => {
  const lastFullyVisibleLayerFrames = layers
    .filter(
      (layer) =>
        layer.type === "text" ||
        layer.type === "image" ||
        layer.type === "illustration" ||
        layer.type === "video",
    )
    .map(({ frameTiming }) => {
      const { exit, from, durationInFrames } = frameTiming;
      const lastFullOpacityOffset = exit.legacy
        ? durationInFrames - 1 - exit.durationInFrames
        : durationInFrames - exit.durationInFrames;

      return from + lastFullOpacityOffset;
    });

  return lastFullyVisibleLayerFrames.length > 0
    ? Math.max(...lastFullyVisibleLayerFrames)
    : sceneDurationInFrames - 1;
};

export const getLayerFrameTiming = (
  sceneFrom: number,
  sceneStartSeconds: number,
  sceneDurationInFrames: number,
  timing: LayerTimingInput | undefined,
  fps: number,
): FrameLayerTiming => {
  const startSeconds = timing?.startSeconds ?? 0;
  const from =
    secondsToFrames(sceneStartSeconds + startSeconds, fps) - sceneFrom;
  const end =
    timing?.durationSeconds === undefined
      ? sceneDurationInFrames
      : secondsToFrames(
          sceneStartSeconds + startSeconds + timing.durationSeconds,
          fps,
        ) - sceneFrom;
  const durationInFrames = end - from;
  const defaultFadeFrames = legacyFadeFrames(durationInFrames);
  const toFrameAnimation = (
    animation: LayerAnimationInput | undefined,
  ): FrameLayerAnimation =>
    animation
      ? {
          preset: animation.preset,
          durationInFrames: secondsToFrames(animation.durationSeconds, fps),
          legacy: false,
        }
      : {
          preset: "fade",
          durationInFrames: defaultFadeFrames,
          legacy: true,
        };

  return {
    from,
    durationInFrames,
    enter: toFrameAnimation(timing?.enter),
    exit: toFrameAnimation(timing?.exit),
  };
};

export const toFrameTimeline = (document: VideoDocument): FrameTimeline => {
  const scenes = document.scenes.map((scene) => {
    const from = secondsToFrames(scene.timing.startSeconds, document.fps);
    const end = secondsToFrames(
      scene.timing.startSeconds + scene.timing.durationSeconds,
      document.fps,
    );
    const durationInFrames = end - from;
    const layers = scene.layers.map((layer) => {
      const layerTiming =
        layer.type === "text" ||
        layer.type === "image" ||
        layer.type === "illustration" ||
        layer.type === "video"
          ? layer.timing
          : undefined;

      return {
        ...layer,
        frameTiming: getLayerFrameTiming(
          from,
          scene.timing.startSeconds,
          durationInFrames,
          layerTiming,
          document.fps,
        ),
      };
    });

    return {
      ...scene,
      from,
      durationInFrames,
      transitionSourceFrame: getTransitionSourceFrame(durationInFrames, layers),
      layers,
    };
  });
  const orderedScenes = [...scenes].sort(
    (left, right) => left.from - right.from,
  );
  const transitionBySceneId = new Map<string, FrameSceneTransition>();

  for (const [index, scene] of orderedScenes.entries()) {
    const previous = orderedScenes[index - 1];
    if (
      scene.transitionIn?.type !== undefined &&
      scene.transitionIn.type !== "cut" &&
      (!previous || previous.from + previous.durationInFrames !== scene.from)
    ) {
      throw new RangeError(
        `Scene "${scene.id}" transition requires a consecutive previous scene.`,
      );
    }

    transitionBySceneId.set(
      scene.id,
      getSceneTransitionTiming(
        scene.transitionIn,
        previous?.durationInFrames ?? 0,
        scene.durationInFrames,
        document.fps,
      ),
    );
  }

  return {
    durationInFrames: secondsToFrames(document.durationSeconds, document.fps),
    scenes: scenes.map((scene) => ({
      ...scene,
      transitionIn: transitionBySceneId.get(scene.id) ?? {
        type: "cut",
        durationInFrames: 0,
      },
    })),
  };
};
