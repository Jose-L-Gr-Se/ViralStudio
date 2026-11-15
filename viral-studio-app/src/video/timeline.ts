import type { VideoDocument } from "./schema";

export type FrameScene = VideoDocument["scenes"][number] & {
  readonly from: number;
  readonly durationInFrames: number;
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

export const toFrameTimeline = (document: VideoDocument): FrameTimeline => ({
  durationInFrames: secondsToFrames(document.durationSeconds, document.fps),
  scenes: document.scenes.map((scene) => {
    const from = secondsToFrames(scene.timing.startSeconds, document.fps);
    const end = secondsToFrames(
      scene.timing.startSeconds + scene.timing.durationSeconds,
      document.fps,
    );

    return {
      ...scene,
      from,
      durationInFrames: end - from,
    };
  }),
});
