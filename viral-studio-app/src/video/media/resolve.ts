import { realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { parseVideoDocument, type VideoDocument } from "../schema";
import {
  MediaAssetSchema,
  MediaManifestSchema,
  parseMediaManifest,
  type MediaAsset,
  type MediaManifest,
} from "./schema";

const EXTENSIONS_BY_KIND = {
  image: new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]),
  illustration: new Set([".png", ".svg", ".webp"]),
  video: new Set([".mp4", ".webm"]),
  audio: new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav"]),
} satisfies Record<MediaAsset["kind"], ReadonlySet<string>>;

export const DEFAULT_MEDIA_ROOT = resolve(process.cwd(), "public", "media");

export type ResolvedMediaAsset = {
  readonly asset: MediaAsset;
  readonly absolutePath: string;
  readonly publicPath: string;
};

export type MediaResolutionOptions = {
  readonly mediaRoot?: string;
};

const isPathInside = (root: string, candidate: string): boolean => {
  const relativePath = relative(root, candidate);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
};

const assertSafeRelativePath = (asset: MediaAsset): void => {
  const mediaPath = asset.path;

  if (
    mediaPath.length === 0 ||
    mediaPath !== mediaPath.trim() ||
    mediaPath.includes("\0") ||
    mediaPath.includes("\\") ||
    mediaPath.includes("%") ||
    mediaPath.includes("?") ||
    mediaPath.includes("#") ||
    mediaPath.includes(":") ||
    isAbsolute(mediaPath) ||
    win32.isAbsolute(mediaPath) ||
    /^[a-z][a-z\d+.-]*:/i.test(mediaPath) ||
    mediaPath
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(
      `Media asset "${asset.id}" has an unsafe path; use a relative path inside public/media.`,
    );
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const resolveMediaAsset = (
  assetInput: unknown,
  mediaRoot = DEFAULT_MEDIA_ROOT,
): ResolvedMediaAsset => {
  const asset = MediaAssetSchema.parse(assetInput);
  assertSafeRelativePath(asset);

  const extension = extname(asset.path).toLowerCase();
  if (!EXTENSIONS_BY_KIND[asset.kind].has(extension)) {
    throw new Error(
      `Media asset "${asset.id}" has extension "${extension || "(none)"}" which is invalid for kind "${asset.kind}".`,
    );
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(resolve(mediaRoot));
  } catch (error) {
    throw new Error(
      `Cannot access media root "${mediaRoot}": ${errorMessage(error)}`,
    );
  }

  const candidate = resolve(canonicalRoot, ...asset.path.split("/"));
  if (!isPathInside(canonicalRoot, candidate)) {
    throw new Error(
      `Media asset "${asset.id}" resolves outside the permitted media root.`,
    );
  }

  let canonicalAssetPath: string;
  try {
    canonicalAssetPath = realpathSync(candidate);
  } catch (error) {
    throw new Error(
      `Media asset "${asset.id}" does not exist at "${asset.path}": ${errorMessage(error)}`,
    );
  }

  if (!isPathInside(canonicalRoot, canonicalAssetPath)) {
    throw new Error(
      `Media asset "${asset.id}" resolves outside the permitted media root.`,
    );
  }

  let isFile: boolean;
  try {
    isFile = statSync(canonicalAssetPath).isFile();
  } catch (error) {
    throw new Error(
      `Cannot inspect media asset "${asset.id}": ${errorMessage(error)}`,
    );
  }

  if (!isFile) {
    throw new Error(`Media asset "${asset.id}" is not a regular file.`);
  }

  return {
    asset,
    absolutePath: canonicalAssetPath,
    publicPath: `media/${asset.path}`,
  };
};

const assertDocumentMatchesManifest = (
  document: VideoDocument,
  manifest: MediaManifest,
): void => {
  const documentEntityIds = new Set<string>([
    document.id,
    ...document.scenes.flatMap((scene) => [
      scene.id,
      ...scene.layers.map((layer) => layer.id),
    ]),
  ]);
  const manifestById = new Map(
    manifest.assets.map((asset) => [asset.id, asset]),
  );

  for (const asset of manifest.assets) {
    if (documentEntityIds.has(asset.id)) {
      throw new Error(
        `Media asset id "${asset.id}" collides with a video, scene, or layer id.`,
      );
    }
  }

  for (const declaredAsset of document.assets) {
    const manifestAsset = manifestById.get(declaredAsset.id);
    if (!manifestAsset) {
      throw new Error(
        `Video document references media asset "${declaredAsset.id}" which is missing from the manifest.`,
      );
    }

    if (
      manifestAsset.kind !== declaredAsset.kind ||
      manifestAsset.path !== declaredAsset.path
    ) {
      throw new Error(
        `Media asset "${declaredAsset.id}" does not match the document's declared kind and path.`,
      );
    }
  }
};

export const resolveVideoMedia = (
  documentInput: unknown,
  manifestInput: unknown,
  options: MediaResolutionOptions = {},
): ReadonlyMap<string, ResolvedMediaAsset> => {
  const document = parseVideoDocument(documentInput);
  const manifest = parseMediaManifest(manifestInput);

  assertDocumentMatchesManifest(document, manifest);

  const manifestById = new Map(
    manifest.assets.map((asset) => [asset.id, asset]),
  );
  const resolvedAssets = new Map<string, ResolvedMediaAsset>();

  for (const declaredAsset of document.assets) {
    const manifestAsset = manifestById.get(declaredAsset.id);
    if (!manifestAsset) {
      throw new Error(
        `Video document references media asset "${declaredAsset.id}" which is missing from the manifest.`,
      );
    }

    resolvedAssets.set(
      manifestAsset.id,
      resolveMediaAsset(manifestAsset, options.mediaRoot),
    );
  }

  return resolvedAssets;
};

export const validateMediaManifest = (input: unknown): MediaManifest =>
  MediaManifestSchema.parse(input);
