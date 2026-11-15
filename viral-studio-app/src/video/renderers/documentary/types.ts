import type { VideoDocument } from "../../schema";

export type DocumentaryMediaKind = "image" | "illustration" | "video";

export type PreparedDocumentaryMedia = {
  readonly id: string;
  readonly kind: DocumentaryMediaKind;
  readonly publicPath: string;
  readonly altText: string;
  readonly focalPoint?: {
    readonly x: number;
    readonly y: number;
  };
};

export type PreparedDocumentary = {
  readonly document: VideoDocument;
  readonly media: readonly PreparedDocumentaryMedia[];
};
