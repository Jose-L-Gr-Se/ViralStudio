import { Composition, registerRoot } from "remotion";
import { parseVideoDocument } from "../../schema";
import { toFrameTimeline } from "../../timeline";
import { DocumentaryRenderer } from "./DocumentaryRenderer";
import type { PreparedDocumentary } from "./types";

type DocumentaryCompositionProps = Partial<PreparedDocumentary>;

const requireDocumentaryProps = (
  props: DocumentaryCompositionProps,
): PreparedDocumentary => {
  if (!props.document || !props.media) {
    throw new Error(
      "Documentary render requires prepared document and media props.",
    );
  }

  return { document: props.document, media: props.media };
};

const DocumentaryComposition: React.FC<DocumentaryCompositionProps> = (
  props,
) => <DocumentaryRenderer {...requireDocumentaryProps(props)} />;

const DocumentaryRenderRoot: React.FC = () => (
  <Composition
    id="DocumentaryVideo"
    component={DocumentaryComposition}
    defaultProps={{}}
    calculateMetadata={({ props }) => {
      const { document } = requireDocumentaryProps(props);
      const parsedDocument = parseVideoDocument(document);

      return {
        width: parsedDocument.width,
        height: parsedDocument.height,
        fps: parsedDocument.fps,
        durationInFrames: toFrameTimeline(parsedDocument).durationInFrames,
      };
    }}
  />
);

registerRoot(DocumentaryRenderRoot);
