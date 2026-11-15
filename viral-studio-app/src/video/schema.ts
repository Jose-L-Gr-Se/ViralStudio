import { z } from "zod";
import { secondsToFrames } from "./timeline";

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

const LayerSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: IdSchema,
      type: z.literal("text"),
      role: z.enum(["headline", "body", "caption", "quote", "callToAction"]),
      text: z.string().min(1),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("image"),
      assetId: IdSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("illustration"),
      assetId: IdSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("video"),
      assetId: IdSchema,
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

const SceneSchema = z
  .object({
    id: IdSchema,
    timing: z
      .object({
        startSeconds: z.number().finite().nonnegative(),
        durationSeconds: z.number().finite().positive(),
      })
      .strict(),
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

      if (
        scene.timing.durationSeconds * document.fps <
        1 - Number.EPSILON * 8
      ) {
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
  },
);

export type VideoDocument = z.infer<typeof VideoDocumentSchema>;
export type VideoScene = VideoDocument["scenes"][number];
export type SceneLayer = VideoScene["layers"][number];
export type VideoAsset = VideoDocument["assets"][number];

export const parseVideoDocument = (input: unknown): VideoDocument =>
  VideoDocumentSchema.parse(input);
