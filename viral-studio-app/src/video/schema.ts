import { z } from "zod";
import {
  getLayerFrameTiming,
  getSceneTransitionTiming,
  isAtLeastOneFrameLong,
  secondsToFrames,
} from "./timeline";

const IdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

const AssetKindSchema = z.enum(["image", "illustration", "video", "audio"]);

const AssetSchema = z
  .object({
    id: IdSchema,
    kind: AssetKindSchema,
    path: z.string().min(1),
  })
  .strict();

const NormalizedLayoutFields = {
  x: z.number().finite().min(-1).max(1),
  y: z.number().finite().min(-1).max(1),
  width: z.number().finite().positive().max(2),
  height: z.number().finite().positive().max(2),
  allowCrop: z.literal(true).optional(),
};

const validateLayoutBounds = (
  layout: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly allowCrop?: true;
  },
  context: z.RefinementCtx,
): void => {
  if (layout.allowCrop) {
    return;
  }

  if (layout.x < 0 || layout.x + layout.width > 1) {
    context.addIssue({
      code: "custom",
      path: ["x"],
      message: "Layout must remain within the canvas unless allowCrop is true.",
    });
  }

  if (layout.y < 0 || layout.y + layout.height > 1) {
    context.addIssue({
      code: "custom",
      path: ["y"],
      message: "Layout must remain within the canvas unless allowCrop is true.",
    });
  }
};

const TextLayoutSchema = z
  .object({
    ...NormalizedLayoutFields,
    align: z.enum(["left", "center", "right"]).optional(),
  })
  .strict()
  .superRefine(validateLayoutBounds);

const MediaLayoutSchema = z
  .object({
    ...NormalizedLayoutFields,
    fit: z.enum(["cover", "contain"]).optional(),
  })
  .strict()
  .superRefine(validateLayoutBounds);

const LayerMotionSchema = z
  .object({
    preset: z.enum(["static", "push-in", "pull-out", "pan-left", "pan-right"]),
    intensity: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

const LayerAnimationSchema = z
  .object({
    preset: z.enum(["fade", "rise", "scale"]),
    durationSeconds: z.number().finite().positive(),
  })
  .strict();

const LayerTimingSchema = z
  .object({
    startSeconds: z.number().finite().nonnegative().optional(),
    durationSeconds: z.number().finite().positive().optional(),
    enter: LayerAnimationSchema.optional(),
    exit: LayerAnimationSchema.optional(),
  })
  .strict();

const LayerSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: IdSchema,
      type: z.literal("text"),
      role: z.enum(["headline", "body", "caption", "quote", "callToAction"]),
      text: z.string().min(1),
      layout: TextLayoutSchema.optional(),
      timing: LayerTimingSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("image"),
      assetId: IdSchema,
      layout: MediaLayoutSchema.optional(),
      motion: LayerMotionSchema.optional(),
      timing: LayerTimingSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("illustration"),
      assetId: IdSchema,
      layout: MediaLayoutSchema.optional(),
      motion: LayerMotionSchema.optional(),
      timing: LayerTimingSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("video"),
      assetId: IdSchema,
      layout: MediaLayoutSchema.optional(),
      motion: LayerMotionSchema.optional(),
      timing: LayerTimingSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("audio"),
      assetId: IdSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("chart"),
      title: z.string().min(1),
      data: z
        .array(
          z
            .object({
              label: z.string().min(1),
              value: z.number().finite(),
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
]);

const SceneTransitionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cut") }).strict(),
  z
    .object({
      type: z.enum(["dissolve", "fade", "wipe"]),
      durationSeconds: z.number().finite().positive(),
    })
    .strict(),
]);

const SceneSchema = z
  .object({
    id: IdSchema,
    timing: z
      .object({
        startSeconds: z.number().finite().nonnegative(),
        durationSeconds: z.number().finite().positive(),
      })
      .strict(),
    transitionIn: SceneTransitionSchema.optional(),
    format: z.enum([
      "documentary",
      "editorial",
      "infographic",
      "illustration",
      "product",
    ]),
    themeId: IdSchema.optional(),
    layers: z.array(LayerSchema).min(1),
  })
  .strict();

const VideoDocumentBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: IdSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    durationSeconds: z.number().finite().positive(),
    themeId: IdSchema,
    assets: z.array(AssetSchema),
    scenes: z.array(SceneSchema).min(1),
  })
  .strict();

export const VideoDocumentSchema = VideoDocumentBaseSchema.superRefine(
  (document, context) => {
    const ids = new Map<string, string>();
    const registerId = (
      id: string,
      kind: string,
      path: Array<string | number>,
    ) => {
      const previousKind = ids.get(id);
      if (previousKind) {
        context.addIssue({
          code: "custom",
          path,
          message: `ID "${id}" is not unique; it is already used by a ${previousKind}.`,
        });
        return;
      }

      ids.set(id, kind);
    };

    const assetById = new Map<string, (typeof document.assets)[number]>();
    for (const [index, asset] of document.assets.entries()) {
      registerId(asset.id, "asset", ["assets", index, "id"]);
      if (!assetById.has(asset.id)) {
        assetById.set(asset.id, asset);
      }
    }

    const ranges: Array<{
      readonly id: string;
      readonly startFrame: number;
      readonly endFrame: number;
      readonly sceneIndex: number;
    }> = [];
    let durationInFrames: number | undefined;
    try {
      durationInFrames = secondsToFrames(
        document.durationSeconds,
        document.fps,
      );
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }

      context.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "Video duration exceeds the safe frame range.",
      });
    }

    for (const [sceneIndex, scene] of document.scenes.entries()) {
      registerId(scene.id, "scene", ["scenes", sceneIndex, "id"]);

      const endSeconds =
        scene.timing.startSeconds + scene.timing.durationSeconds;
      let startFrame: number | undefined;
      let endFrame: number | undefined;
      try {
        startFrame = secondsToFrames(scene.timing.startSeconds, document.fps);
        endFrame = secondsToFrames(endSeconds, document.fps);
      } catch (error) {
        if (!(error instanceof RangeError)) {
          throw error;
        }

        context.addIssue({
          code: "custom",
          path: ["scenes", sceneIndex, "timing"],
          message: `Scene "${scene.id}" exceeds the safe frame range.`,
        });
      }

      if (!isAtLeastOneFrameLong(scene.timing.durationSeconds, document.fps)) {
        context.addIssue({
          code: "custom",
          path: ["scenes", sceneIndex, "timing", "durationSeconds"],
          message: `Scene "${scene.id}" is shorter than one frame at ${document.fps} fps.`,
        });
      }

      for (const [layerIndex, layer] of scene.layers.entries()) {
        registerId(layer.id, "layer", [
          "scenes",
          sceneIndex,
          "layers",
          layerIndex,
          "id",
        ]);

        if (layer.type !== "text" && layer.type !== "chart") {
          const asset = assetById.get(layer.assetId);
          if (!asset) {
            context.addIssue({
              code: "custom",
              path: ["scenes", sceneIndex, "layers", layerIndex, "assetId"],
              message: `Layer "${layer.id}" references missing asset "${layer.assetId}".`,
            });
          } else if (asset.kind !== layer.type) {
            context.addIssue({
              code: "custom",
              path: ["scenes", sceneIndex, "layers", layerIndex, "assetId"],
              message: `Layer "${layer.id}" expects an "${layer.type}" asset, but "${layer.assetId}" is "${asset.kind}".`,
            });
          }
        }
      }

      if (startFrame === undefined || endFrame === undefined) {
        continue;
      }

      if (endFrame <= startFrame) {
        context.addIssue({
          code: "custom",
          path: ["scenes", sceneIndex, "timing", "durationSeconds"],
          message: `Scene "${scene.id}" does not occupy a video frame.`,
        });
      }

      if (durationInFrames !== undefined && endFrame > durationInFrames) {
        context.addIssue({
          code: "custom",
          path: ["scenes", sceneIndex, "timing"],
          message: `Scene "${scene.id}" exceeds the video frame duration.`,
        });
      }

      const sceneDurationInFrames = endFrame - startFrame;
      for (const [layerIndex, layer] of scene.layers.entries()) {
        if (
          layer.type !== "text" &&
          layer.type !== "image" &&
          layer.type !== "illustration" &&
          layer.type !== "video"
        ) {
          continue;
        }

        const path = ["scenes", sceneIndex, "layers", layerIndex, "timing"];
        let frameTiming: ReturnType<typeof getLayerFrameTiming>;
        try {
          frameTiming = getLayerFrameTiming(
            startFrame,
            scene.timing.startSeconds,
            sceneDurationInFrames,
            layer.timing,
            document.fps,
          );
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }

          context.addIssue({
            code: "custom",
            path,
            message: `Layer "${layer.id}" timing exceeds the safe frame range.`,
          });
          continue;
        }

        if (frameTiming.durationInFrames <= 0) {
          context.addIssue({
            code: "custom",
            path,
            message: `Layer "${layer.id}" must remain visible for at least one frame.`,
          });
          continue;
        }

        if (
          frameTiming.from < 0 ||
          frameTiming.from + frameTiming.durationInFrames >
            sceneDurationInFrames
        ) {
          context.addIssue({
            code: "custom",
            path,
            message: `Layer "${layer.id}" must fit within scene "${scene.id}" in frames.`,
          });
        }

        if (
          (layer.timing?.enter && frameTiming.enter.durationInFrames < 2) ||
          (layer.timing?.exit && frameTiming.exit.durationInFrames < 2)
        ) {
          context.addIssue({
            code: "custom",
            path,
            message: `Layer "${layer.id}" entrance and exit animations must each span at least two frames.`,
          });
        }

        if (
          frameTiming.enter.durationInFrames +
            frameTiming.exit.durationInFrames >=
          frameTiming.durationInFrames
        ) {
          context.addIssue({
            code: "custom",
            path,
            message: `Layer "${layer.id}" entrance and exit must leave at least one visible frame.`,
          });
        }
      }

      ranges.push({
        id: scene.id,
        startFrame,
        endFrame,
        sceneIndex,
      });
    }

    const orderedRanges = [...ranges].sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        left.sceneIndex - right.sceneIndex,
    );

    let previousRange: (typeof orderedRanges)[number] | undefined;
    for (const current of orderedRanges) {
      if (previousRange && current.startFrame < previousRange.endFrame) {
        context.addIssue({
          code: "custom",
          path: ["scenes", current.sceneIndex, "timing", "startSeconds"],
          message: `Scene "${current.id}" overlaps scene "${previousRange.id}" in frame range [${previousRange.startFrame}, ${previousRange.endFrame}).`,
        });
      }

      if (!previousRange || current.endFrame > previousRange.endFrame) {
        previousRange = current;
      }
    }

    for (const [rangeIndex, current] of orderedRanges.entries()) {
      const scene = document.scenes[current.sceneIndex];
      const transition = scene.transitionIn;
      if (!transition || transition.type === "cut") {
        continue;
      }

      const previous = orderedRanges[rangeIndex - 1];
      const path = ["scenes", current.sceneIndex, "transitionIn"];
      if (!previous) {
        context.addIssue({
          code: "custom",
          path,
          message: `Scene "${scene.id}" cannot transition in because it is the first scene.`,
        });
        continue;
      }

      if (previous.endFrame !== current.startFrame) {
        context.addIssue({
          code: "custom",
          path,
          message: `Scene "${scene.id}" can only transition from a scene with a consecutive frame interval.`,
        });
        continue;
      }

      try {
        getSceneTransitionTiming(
          transition,
          previous.endFrame - previous.startFrame,
          current.endFrame - current.startFrame,
          document.fps,
        );
      } catch (error) {
        if (!(error instanceof RangeError)) {
          throw error;
        }

        context.addIssue({
          code: "custom",
          path,
          message: `Scene "${scene.id}" transition is too short for the available adjacent frames.`,
        });
      }
    }
  },
);

export type VideoDocument = z.infer<typeof VideoDocumentSchema>;
export type VideoScene = VideoDocument["scenes"][number];
export type SceneLayer = VideoScene["layers"][number];
export type VideoAsset = VideoDocument["assets"][number];

export const parseVideoDocument = (input: unknown): VideoDocument =>
  VideoDocumentSchema.parse(input);
