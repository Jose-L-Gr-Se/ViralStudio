import { Composition, registerRoot } from "remotion";
import { DocumentaryRenderer } from "../src/video/renderers/documentary/DocumentaryRenderer";
import { DOCUMENTARY_PREVIEW } from "../src/video/renderers/documentary/preview";

const DocumentaryProofRoot: React.FC = () => (
  <Composition
    id="DocumentaryProof"
    component={DocumentaryRenderer}
    durationInFrames={24 * 30}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={DOCUMENTARY_PREVIEW}
  />
);

registerRoot(DocumentaryProofRoot);
