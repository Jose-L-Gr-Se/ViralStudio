import { Composition, Folder } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { Title } from "./HelloWorld/Title";
import { VerticalPromo } from "./VerticalPromo";
import { DocumentaryRenderer } from "./video/renderers/documentary/DocumentaryRenderer";
import {
  DOCUMENTARY_PREVIEW,
  DOCUMENTARY_PREVIEW_DURATION_IN_FRAMES,
} from "./video/renderers/documentary/preview";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Elements">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            logoColor1: "#91EAE4",
            logoColor2: "#86A8E7",
          }}
        />
        <Composition
          id="Title"
          component={Title}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            titleText: "Welcome to Remotion",
            titleColor: "#000000",
          }}
        />
      </Folder>
      <Composition
        // You can take the "id" to render a video:
        // bunx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />
      <Folder name="Vertical">
        <Composition
          id="ViralVertical"
          component={VerticalPromo}
          durationInFrames={450}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DocumentaryPreview"
          component={DocumentaryRenderer}
          durationInFrames={DOCUMENTARY_PREVIEW_DURATION_IN_FRAMES}
          fps={DOCUMENTARY_PREVIEW.document.fps}
          width={DOCUMENTARY_PREVIEW.document.width}
          height={DOCUMENTARY_PREVIEW.document.height}
          defaultProps={DOCUMENTARY_PREVIEW}
        />
      </Folder>
    </>
  );
};
