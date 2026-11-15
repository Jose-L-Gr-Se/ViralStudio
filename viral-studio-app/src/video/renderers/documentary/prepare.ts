import { parseVideoDocument } from "../../schema";
import {
  resolveVideoMedia,
  type MediaResolutionOptions,
  type ResolvedMediaAsset,
} from "../../media/resolve";
import type { PreparedDocumentary, PreparedDocumentaryMedia } from "./types";
import { assertDocumentarySupport } from "./support";

const toPreparedMedia = (
  asset: ResolvedMediaAsset,
): PreparedDocumentaryMedia => {
  if (asset.asset.kind === "audio") {
    throw new Error(
      `Documentary renderer does not support audio asset "${asset.asset.id}".`,
    );
  }

  const media: PreparedDocumentaryMedia = {
    id: asset.asset.id,
    kind: asset.asset.kind,
    publicPath: asset.publicPath,
    altText: asset.asset.altText,
  };

  if (
    (asset.asset.kind === "image" || asset.asset.kind === "illustration") &&
    asset.asset.focalPoint
  ) {
    return { ...media, focalPoint: asset.asset.focalPoint };
  }

  return media;
};

export const prepareDocumentaryRender = (
  documentInput: unknown,
  manifestInput: unknown,
  options: MediaResolutionOptions = {},
): PreparedDocumentary => {
  const document = parseVideoDocument(documentInput);
  assertDocumentarySupport(document);

  const resolvedMedia = resolveVideoMedia(document, manifestInput, options);

  return {
    document,
    media: [...resolvedMedia.values()].map(toPreparedMedia),
  };
};
