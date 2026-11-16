import { Fragment, useMemo } from "react";
import {
  AbsoluteFill,
  Freeze,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getTheme } from "../../themes/catalog";
import { parseVideoDocument } from "../../schema";
import {
  toFrameTimeline,
  type FrameScene,
  type FrameSceneTransition,
} from "../../timeline";
import { DocumentarySceneContent } from "./DocumentarySceneContent";
import { assertDocumentarySupport } from "./support";
import type { PreparedDocumentary } from "./types";
import { getSceneTransitionState } from "./transitions";

export type DocumentaryRendererProps = PreparedDocumentary;

type SceneTransitionProps = {
  readonly sceneTransition: FrameSceneTransition;
  readonly backgroundColor: string;
  readonly scene: FrameScene;
  readonly assets: PreparedDocumentary["document"]["assets"];
  readonly media: PreparedDocumentary["media"];
  readonly defaultThemeId: string;
};

const SceneTransition = (props: SceneTransitionProps) => {
  const {
    sceneTransition,
    backgroundColor,
    scene,
    assets,
    media,
    defaultThemeId,
  } = props;
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [0, Math.max(1, sceneTransition.durationInFrames - 1)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const state = getSceneTransitionState(sceneTransition.type, progress);

  if (sceneTransition.type === "cut") {
    return (
      <DocumentarySceneContent
        scene={scene}
        assets={assets}
        media={media}
        defaultThemeId={defaultThemeId}
      />
    );
  }

  const incomingStyle: React.CSSProperties = {
    opacity: state.incomingOpacity,
    clipPath: state.clipPath,
    overflow: "hidden",
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {sceneTransition.type === "fade" ? (
        <AbsoluteFill
          style={{
            backgroundColor,
            opacity: state.matteOpacity,
          }}
        />
      ) : null}
      <AbsoluteFill style={incomingStyle}>
        <DocumentarySceneContent
          scene={scene}
          assets={assets}
          media={media}
          defaultThemeId={defaultThemeId}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const DocumentaryRenderer: React.FC<DocumentaryRendererProps> = ({
  document: documentInput,
  media,
}) => {
  const document = useMemo(() => {
    const parsedDocument = parseVideoDocument(documentInput);
    assertDocumentarySupport(parsedDocument);
    return parsedDocument;
  }, [documentInput]);
  const timeline = useMemo(() => toFrameTimeline(document), [document]);
  const composition = useVideoConfig();

  if (
    composition.width !== document.width ||
    composition.height !== document.height ||
    composition.fps !== document.fps ||
    composition.durationInFrames !== timeline.durationInFrames
  ) {
    throw new Error(
      "Documentary renderer composition dimensions, FPS, and duration must match the video document.",
    );
  }

  const orderedScenes = [...timeline.scenes].sort(
    (left, right) => left.from - right.from,
  );
  const previousSceneById = new Map<string, FrameScene>();
  for (let index = 1; index < orderedScenes.length; index++) {
    const previousScene = orderedScenes[index - 1];
    const scene = orderedScenes[index];
    if (previousScene.from + previousScene.durationInFrames === scene.from) {
      previousSceneById.set(scene.id, previousScene);
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: getTheme(document.themeId).backgrounds.canvas,
        overflow: "hidden",
      }}
    >
      {timeline.scenes.map((scene) => {
        const theme = getTheme(scene.themeId ?? document.themeId);
        const previousScene = previousSceneById.get(scene.id);

        if (scene.transitionIn.durationInFrames > 0 && !previousScene) {
          throw new Error(
            `Documentary transition for scene "${scene.id}" has no consecutive previous scene.`,
          );
        }

        return (
          <Fragment key={scene.id}>
            {previousScene && scene.transitionIn.durationInFrames > 0 ? (
              <Sequence
                name={`${scene.id}-transition-source`}
                from={scene.from}
                durationInFrames={scene.transitionIn.durationInFrames}
              >
                <Freeze frame={previousScene.transitionSourceFrame}>
                  <DocumentarySceneContent
                    scene={previousScene}
                    assets={document.assets}
                    media={media}
                    defaultThemeId={document.themeId}
                  />
                </Freeze>
              </Sequence>
            ) : null}
            <Sequence
              name={scene.id}
              from={scene.from}
              durationInFrames={scene.durationInFrames}
            >
              <SceneTransition
                sceneTransition={scene.transitionIn}
                backgroundColor={theme.backgrounds.canvas}
                scene={scene}
                assets={document.assets}
                media={media}
                defaultThemeId={document.themeId}
              />
            </Sequence>
          </Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
