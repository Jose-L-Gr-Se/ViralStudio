import { z } from "zod";

const IdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

const ProvenanceSchema = z
  .object({
    type: z.enum([
      "original",
      "user-provided",
      "stock",
      "public-domain",
      "licensed",
    ]),
    source: z.string().trim().min(1),
  })
  .strict();

const FocalPointSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict();

const AssetMetadataSchema = z
  .object({
    id: IdSchema,
    path: z.string().min(1),
    provenance: ProvenanceSchema,
    license: z.string().trim().min(1),
    credits: z.string().trim().min(1),
    altText: z.string().trim().min(1),
  })
  .strict();

const ImageAssetSchema = AssetMetadataSchema.extend({
  kind: z.literal("image"),
  focalPoint: FocalPointSchema.optional(),
}).strict();

const IllustrationAssetSchema = AssetMetadataSchema.extend({
  kind: z.literal("illustration"),
  focalPoint: FocalPointSchema.optional(),
}).strict();

const VideoAssetSchema = AssetMetadataSchema.extend({
  kind: z.literal("video"),
}).strict();

const AudioAssetSchema = AssetMetadataSchema.extend({
  kind: z.literal("audio"),
}).strict();

export const MediaAssetSchema = z.discriminatedUnion("kind", [
  ImageAssetSchema,
  IllustrationAssetSchema,
  VideoAssetSchema,
  AudioAssetSchema,
]);

export const MediaManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    assets: z.array(MediaAssetSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();

    for (const [index, asset] of manifest.assets.entries()) {
      if (ids.has(asset.id)) {
        context.addIssue({
          code: "custom",
          path: ["assets", index, "id"],
          message: `Duplicate media asset id "${asset.id}".`,
        });
      } else {
        ids.add(asset.id);
      }
    }
  });

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaManifest = z.infer<typeof MediaManifestSchema>;

export const parseMediaManifest = (input: unknown): MediaManifest =>
  MediaManifestSchema.parse(input);
