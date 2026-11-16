import type { FrameSceneTransition } from "../../timeline";

export type SceneTransitionState = {
  readonly incomingOpacity: number;
  readonly matteOpacity: number;
  readonly clipPath: string | undefined;
};

export const getSceneTransitionState = (
  type: FrameSceneTransition["type"],
  progress: number,
): SceneTransitionState => {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("Transition progress must be between zero and one.");
  }

  if (type === "cut") {
    return {
      incomingOpacity: 1,
      matteOpacity: 0,
      clipPath: undefined,
    };
  }

  switch (type) {
    case "dissolve":
      return {
        incomingOpacity: progress,
        matteOpacity: 0,
        clipPath: undefined,
      };
    case "fade":
      return {
        incomingOpacity: Math.max(0, (progress - 0.5) * 2),
        matteOpacity: Math.max(0, 1 - Math.abs(2 * progress - 1)),
        clipPath: undefined,
      };
    case "wipe":
      return {
        incomingOpacity: 1,
        matteOpacity: 0,
        clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
      };
  }
};
