import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);

const {
  parseVideoDocument,
  VideoDocumentSchema,
} = require("../src/video/schema.ts");
const {
  getLayerFrameTiming,
  secondsToFrames,
  toFrameTimeline,
} = require("../src/video/timeline.ts");

const validDocument = () => ({
  schemaVersion: 1,
  id: "sustainable-food",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 10,
  themeId: "forest-editorial",
  assets: [{ id: "garden-footage", kind: "video", path: "media/garden.mp4" }],
  scenes: [
    {
      id: "opening",
      timing: { startSeconds: 0, durationSeconds: 4 },
      format: "documentary",
      layers: [
        {
          id: "opening-copy",
          type: "text",
          role: "headline",
          text: "Grow well",
        },
        { id: "garden-shot", type: "video", assetId: "garden-footage" },
      ],
    },
    {
      id: "closing",
      timing: { startSeconds: 4, durationSeconds: 6 },
      format: "editorial",
      layers: [
        {
          id: "closing-copy",
          type: "text",
          role: "callToAction",
          text: "Choose better",
        },
      ],
    },
  ],
});

test("parses a versioned video document and infers its frame timeline", () => {
  const document = parseVideoDocument(validDocument());
  const timeline = toFrameTimeline(document);

  assert.equal(document.schemaVersion, 1);
  assert.equal(timeline.durationInFrames, 300);
  assert.deepEqual(
    timeline.scenes.map(({ from, durationInFrames }) => ({
      from,
      durationInFrames,
    })),
    [
      { from: 0, durationInFrames: 120 },
      { from: 120, durationInFrames: 180 },
    ],
  );
});

test("rejects unsupported schema versions and duplicate IDs", () => {
  const unsupportedVersion = validDocument();
  unsupportedVersion.schemaVersion = 2;
  assert.equal(
    VideoDocumentSchema.safeParse(unsupportedVersion).success,
    false,
  );

  const duplicateSceneId = validDocument();
  duplicateSceneId.scenes[1].id = duplicateSceneId.scenes[0].id;
  assert.equal(VideoDocumentSchema.safeParse(duplicateSceneId).success, false);

  const duplicateAssetId = validDocument();
  duplicateAssetId.assets.push({ ...duplicateAssetId.assets[0] });
  assert.equal(VideoDocumentSchema.safeParse(duplicateAssetId).success, false);

  const sceneAssetCollision = validDocument();
  sceneAssetCollision.scenes[0].id = sceneAssetCollision.assets[0].id;
  assert.equal(
    VideoDocumentSchema.safeParse(sceneAssetCollision).success,
    false,
  );

  const layerSceneCollision = validDocument();
  layerSceneCollision.scenes[0].layers[0].id = layerSceneCollision.scenes[1].id;
  assert.equal(
    VideoDocumentSchema.safeParse(layerSceneCollision).success,
    false,
  );
});

test("rejects missing and mismatched resource references", () => {
  const missingAsset = validDocument();
  missingAsset.scenes[0].layers[1].assetId = "unknown";
  assert.equal(VideoDocumentSchema.safeParse(missingAsset).success, false);

  const wrongKind = validDocument();
  wrongKind.scenes[0].layers[1].type = "image";
  assert.equal(VideoDocumentSchema.safeParse(wrongKind).success, false);
});

test("accepts normalized text and media layouts", () => {
  const document = validDocument();
  document.scenes[0].layers[0].layout = {
    x: 0.1,
    y: 0.2,
    width: 0.8,
    height: 0.3,
    align: "right",
  };
  document.scenes[0].layers[1].layout = {
    x: 0.05,
    y: 0.1,
    width: 0.9,
    height: 0.8,
    fit: "contain",
  };

  const result = VideoDocumentSchema.safeParse(document);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scenes[0].layers[0].layout.align, "right");
    assert.equal(result.data.scenes[0].layers[1].layout.fit, "contain");
  }
});

test("rejects invalid layout bounds, dimensions, and enum values", () => {
  const invalidCases = [
    (document) => {
      document.scenes[0].layers[0].layout = {
        x: -0.1,
        y: 0,
        width: 0.5,
        height: 0.5,
      };
    },
    (document) => {
      document.scenes[0].layers[0].layout = {
        x: 0.8,
        y: 0,
        width: 0.3,
        height: 0.5,
      };
    },
    (document) => {
      document.scenes[0].layers[0].layout = {
        x: 0,
        y: 0,
        width: 0,
        height: 0.5,
      };
    },
    (document) => {
      document.scenes[0].layers[0].layout = {
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        align: "justify",
      };
    },
    (document) => {
      document.scenes[0].layers[1].layout = {
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        fit: "fill",
      };
    },
  ];

  for (const applyInvalidLayout of invalidCases) {
    const document = validDocument();
    applyInvalidLayout(document);
    assert.equal(VideoDocumentSchema.safeParse(document).success, false);
  }
});

test("permits out-of-canvas layout only with explicit bounded cropping", () => {
  const document = validDocument();
  document.scenes[0].layers[0].layout = {
    x: -0.1,
    y: 0.2,
    width: 1.2,
    height: 0.7,
    allowCrop: true,
  };
  assert.equal(VideoDocumentSchema.safeParse(document).success, true);

  document.scenes[0].layers[0].layout.width = 2.1;
  assert.equal(VideoDocumentSchema.safeParse(document).success, false);
});

test("validates optional media motion and per-layer timing in frames", () => {
  const document = validDocument();
  document.scenes[0].timing.startSeconds = 0.1;
  document.scenes[0].timing.durationSeconds = 3.9;
  document.scenes[0].layers[0].timing = {
    startSeconds: 0.05,
    durationSeconds: 1,
    enter: { preset: "fade", durationSeconds: 0.1 },
    exit: { preset: "rise", durationSeconds: 0.1 },
  };
  document.scenes[0].layers[1].motion = {
    preset: "push-in",
    intensity: 0.6,
  };

  const result = VideoDocumentSchema.safeParse(document);
  assert.equal(result.success, true);
  if (result.success) {
    const timeline = toFrameTimeline(result.data);
    const [textLayer, mediaLayer] = timeline.scenes[0].layers;
    assert.deepEqual(textLayer.frameTiming, {
      from: 2,
      durationInFrames: 30,
      enter: { preset: "fade", durationInFrames: 3, legacy: false },
      exit: { preset: "rise", durationInFrames: 3, legacy: false },
    });
    assert.equal(mediaLayer.motion.preset, "push-in");
    assert.equal(mediaLayer.frameTiming.from, 0);
    assert.equal(mediaLayer.frameTiming.durationInFrames, 117);
  }
});

test("keeps full-scene timing and legacy fades when timing is omitted", () => {
  const document = parseVideoDocument(validDocument());
  const layerTiming = getLayerFrameTiming(
    0,
    document.scenes[0].timing.startSeconds,
    120,
    undefined,
    document.fps,
  );

  assert.deepEqual(layerTiming, {
    from: 0,
    durationInFrames: 120,
    enter: { preset: "fade", durationInFrames: 15, legacy: true },
    exit: { preset: "fade", durationInFrames: 15, legacy: true },
  });
});

test("motion and timing defaults remain independent properties", () => {
  const document = validDocument();
  document.scenes[0].layers[1].motion = { preset: "static" };
  const parsed = parseVideoDocument(document);
  const [textLayer, mediaLayer] = toFrameTimeline(parsed).scenes[0].layers;

  assert.equal("motion" in textLayer, false);
  assert.equal(mediaLayer.motion.preset, "static");
  assert.equal(mediaLayer.frameTiming.from, 0);
  assert.equal(mediaLayer.frameTiming.durationInFrames, 120);
  assert.equal(mediaLayer.frameTiming.enter.durationInFrames, 15);
  assert.equal(mediaLayer.frameTiming.enter.legacy, true);

  const timedOnly = validDocument();
  timedOnly.scenes[0].layers[0].timing = {
    startSeconds: 1,
    durationSeconds: 1,
  };
  const timedDocument = parseVideoDocument(timedOnly);
  const [timedText] = toFrameTimeline(timedDocument).scenes[0].layers;

  assert.equal("motion" in timedText, false);
  assert.equal(timedText.frameTiming.from, 30);
  assert.equal(timedText.frameTiming.durationInFrames, 30);
  assert.equal(timedText.frameTiming.enter.legacy, true);
});

test("rejects layer intervals outside their scene or with no visible frames", () => {
  const exactEnd = validDocument();
  exactEnd.scenes[0].layers[0].timing = {
    startSeconds: 3,
    durationSeconds: 1,
  };
  assert.equal(VideoDocumentSchema.safeParse(exactEnd).success, true);

  const pastEnd = validDocument();
  pastEnd.scenes[0].layers[0].timing = {
    startSeconds: 3,
    durationSeconds: 1 + 1 / 30,
  };
  assert.equal(VideoDocumentSchema.safeParse(pastEnd).success, false);

  const noVisibleFrames = validDocument();
  noVisibleFrames.scenes[0].layers[0].timing = { startSeconds: 4 };
  assert.equal(VideoDocumentSchema.safeParse(noVisibleFrames).success, false);
});

test("rejects negative layer times and animation durations", () => {
  const invalidCases = [
    { startSeconds: -0.1 },
    { durationSeconds: -0.1 },
    { enter: { preset: "fade", durationSeconds: -0.1 } },
    { exit: { preset: "scale", durationSeconds: 0 } },
  ];

  for (const timing of invalidCases) {
    const document = validDocument();
    document.scenes[0].layers[0].timing = timing;
    assert.equal(VideoDocumentSchema.safeParse(document).success, false);
  }
});

test("rejects animations rounded below two frames or consuming visible time", () => {
  const lessThanTwoFrames = validDocument();
  lessThanTwoFrames.scenes[0].layers[0].timing = {
    durationSeconds: 1,
    enter: { preset: "fade", durationSeconds: 0.03 },
  };
  assert.equal(VideoDocumentSchema.safeParse(lessThanTwoFrames).success, false);

  const consumesAll = validDocument();
  consumesAll.scenes[0].layers[0].timing = {
    durationSeconds: 1,
    enter: { preset: "fade", durationSeconds: 0.5 },
    exit: { preset: "rise", durationSeconds: 0.5 },
  };
  assert.equal(VideoDocumentSchema.safeParse(consumesAll).success, false);

  const exceedsVisibleTime = validDocument();
  exceedsVisibleTime.scenes[0].layers[0].timing = {
    durationSeconds: 1,
    enter: { preset: "fade", durationSeconds: 0.6 },
    exit: { preset: "rise", durationSeconds: 0.5 },
  };
  assert.equal(
    VideoDocumentSchema.safeParse(exceedsVisibleTime).success,
    false,
  );
});

test("rejects invalid media motion presets and intensities", () => {
  const invalidCases = [
    { preset: "zoom" },
    { preset: "pan-left", intensity: -0.1 },
    { preset: "pull-out", intensity: 1.1 },
  ];

  for (const motion of invalidCases) {
    const document = validDocument();
    document.scenes[0].layers[1].motion = motion;
    assert.equal(VideoDocumentSchema.safeParse(document).success, false);
  }
});

test("rejects overlapping scenes and scenes beyond the video duration", () => {
  const overlap = validDocument();
  overlap.scenes[1].timing.startSeconds = 3.5;
  assert.equal(VideoDocumentSchema.safeParse(overlap).success, false);

  const nestedOverlap = validDocument();
  nestedOverlap.scenes[0].timing.durationSeconds = 8;
  nestedOverlap.scenes[1].timing.startSeconds = 1;
  nestedOverlap.scenes[1].timing.durationSeconds = 1;
  assert.equal(VideoDocumentSchema.safeParse(nestedOverlap).success, false);

  const beyondDuration = validDocument();
  beyondDuration.scenes[1].timing.durationSeconds = 7;
  assert.equal(VideoDocumentSchema.safeParse(beyondDuration).success, false);
});

test("accepts consecutive scenes whose frame intervals share a boundary", () => {
  const document = validDocument();
  const result = VideoDocumentSchema.safeParse(document);

  assert.equal(result.success, true);
  if (result.success) {
    const timeline = toFrameTimeline(result.data);
    assert.equal(
      timeline.scenes[0].from + timeline.scenes[0].durationInFrames,
      120,
    );
    assert.equal(timeline.scenes[1].from, 120);
  }
});

test("normalizes visual scene transitions in frames without changing the timeline", () => {
  for (const type of ["dissolve", "fade", "wipe"]) {
    const document = validDocument();
    document.scenes[1].transitionIn = {
      type,
      durationSeconds: 0.6,
    };

    const parsed = parseVideoDocument(document);
    const timeline = toFrameTimeline(parsed);

    assert.deepEqual(timeline.scenes[1].transitionIn, {
      type,
      durationInFrames: 18,
    });
    assert.deepEqual(
      timeline.scenes.map(({ from, durationInFrames }) => ({
        from,
        durationInFrames,
      })),
      [
        { from: 0, durationInFrames: 120 },
        { from: 120, durationInFrames: 180 },
      ],
    );
    assert.equal(timeline.durationInFrames, 300);
  }
});

test("caps transition duration to adjacent scene frames", () => {
  const document = validDocument();
  document.scenes[1].transitionIn = {
    type: "dissolve",
    durationSeconds: 8,
  };

  const timeline = toFrameTimeline(parseVideoDocument(document));
  assert.equal(timeline.scenes[1].transitionIn.durationInFrames, 120);
  assert.equal(timeline.durationInFrames, 300);
});

test("validates transition boundaries and short adjacent scenes", () => {
  const firstSceneTransition = validDocument();
  firstSceneTransition.scenes[0].transitionIn = {
    type: "wipe",
    durationSeconds: 0.5,
  };
  assert.equal(
    VideoDocumentSchema.safeParse(firstSceneTransition).success,
    false,
  );

  const gap = validDocument();
  gap.scenes[1].timing.startSeconds = 4.1;
  gap.scenes[1].timing.durationSeconds = 5.9;
  gap.scenes[1].transitionIn = {
    type: "dissolve",
    durationSeconds: 0.5,
  };
  assert.equal(VideoDocumentSchema.safeParse(gap).success, false);

  const shortButValid = validDocument();
  shortButValid.scenes[0].timing.durationSeconds = 0.1;
  shortButValid.scenes[1].timing.startSeconds = 0.1;
  shortButValid.scenes[1].timing.durationSeconds = 9.9;
  shortButValid.scenes[1].transitionIn = {
    type: "dissolve",
    durationSeconds: 0.5,
  };
  const parsedShort = VideoDocumentSchema.safeParse(shortButValid);
  assert.equal(parsedShort.success, true);
  if (parsedShort.success) {
    const timeline = toFrameTimeline(parsedShort.data);
    assert.equal(timeline.scenes[1].transitionIn.durationInFrames, 3);
    assert.equal(timeline.durationInFrames, 300);
  }

  const tooShort = structuredClone(shortButValid);
  tooShort.scenes[0].timing.durationSeconds = 0.05;
  tooShort.scenes[1].timing.startSeconds = 0.05;
  tooShort.scenes[1].timing.durationSeconds = 9.95;
  assert.equal(VideoDocumentSchema.safeParse(tooShort).success, false);
});

test("supports a transition into the final scene and preserves legacy cuts", () => {
  const legacyDocument = parseVideoDocument(validDocument());
  const legacyTimeline = toFrameTimeline(legacyDocument);
  assert.deepEqual(
    legacyTimeline.scenes.map((scene) => scene.transitionIn),
    [
      { type: "cut", durationInFrames: 0 },
      { type: "cut", durationInFrames: 0 },
    ],
  );

  const finalSceneTransition = validDocument();
  finalSceneTransition.scenes[1].transitionIn = {
    type: "fade",
    durationSeconds: 1,
  };
  const timeline = toFrameTimeline(parseVideoDocument(finalSceneTransition));
  assert.equal(timeline.scenes[1].transitionIn.type, "fade");
  assert.equal(timeline.scenes[1].transitionIn.durationInFrames, 30);
  assert.equal(timeline.durationInFrames, 300);
});

test("chooses a visible outgoing layer frame for transition snapshots", () => {
  const legacyTimeline = toFrameTimeline(parseVideoDocument(validDocument()));
  assert.equal(legacyTimeline.scenes[0].transitionSourceFrame, 104);

  const document = validDocument();
  document.scenes[0].layers[1].timing = {
    startSeconds: 1,
    durationSeconds: 3,
    exit: { preset: "fade", durationSeconds: 0.5 },
  };

  const timeline = toFrameTimeline(parseVideoDocument(document));
  assert.equal(timeline.scenes[0].transitionSourceFrame, 105);
  assert.equal(timeline.scenes[1].transitionSourceFrame, 164);
});

test("rejects scenes overlapping by exactly one frame", () => {
  const document = validDocument();
  document.scenes[1].timing.startSeconds = 119 / 30;

  assert.equal(VideoDocumentSchema.safeParse(document).success, false);
});

test("rejects scenes shorter than one frame", () => {
  const document = validDocument();
  document.scenes[0].timing.durationSeconds = 0.02;

  assert.equal(VideoDocumentSchema.safeParse(document).success, false);
});

test("quantizes decimal timestamps independently to avoid accumulated rounding", () => {
  const document = validDocument();
  document.durationSeconds = 1;
  document.scenes = [
    {
      id: "decimal-1",
      timing: { startSeconds: 0, durationSeconds: 0.1 },
      format: "documentary",
      layers: [
        { id: "decimal-copy-1", type: "text", role: "body", text: "One" },
      ],
    },
    {
      id: "decimal-2",
      timing: { startSeconds: 0.1, durationSeconds: 0.2 },
      format: "editorial",
      layers: [
        { id: "decimal-copy-2", type: "text", role: "body", text: "Two" },
      ],
    },
    {
      id: "decimal-3",
      timing: { startSeconds: 0.3, durationSeconds: 0.7 },
      format: "illustration",
      layers: [
        { id: "decimal-copy-3", type: "text", role: "body", text: "Three" },
      ],
    },
  ];

  const documentResult = VideoDocumentSchema.safeParse(document);
  assert.equal(documentResult.success, true);
  if (documentResult.success) {
    const timeline = toFrameTimeline(documentResult.data);
    assert.deepEqual(
      timeline.scenes.map(({ from, durationInFrames }) => [
        from,
        durationInFrames,
      ]),
      [
        [0, 3],
        [3, 6],
        [9, 21],
      ],
    );
  }
});

test("allows a scene ending exactly at the video duration", () => {
  const document = validDocument();
  const result = VideoDocumentSchema.safeParse(document);

  assert.equal(result.success, true);
  if (result.success) {
    const timeline = toFrameTimeline(result.data);
    const finalScene = timeline.scenes.at(-1);
    assert.equal(finalScene?.from + finalScene?.durationInFrames, 300);
    assert.equal(timeline.durationInFrames, 300);
  }

  const pastEnd = validDocument();
  pastEnd.scenes[1].timing.durationSeconds += 1 / 30;
  assert.equal(VideoDocumentSchema.safeParse(pastEnd).success, false);
});

test("converts seconds to frames and rejects invalid time values", () => {
  assert.equal(secondsToFrames(1.5, 30), 45);
  assert.equal(secondsToFrames(0.05, 30), 2);
  assert.throws(() => secondsToFrames(-1, 30), RangeError);
  assert.throws(() => secondsToFrames(1, 0), RangeError);
  assert.throws(() => secondsToFrames(1, Number.MAX_VALUE), RangeError);
  assert.throws(() => secondsToFrames(Number.MAX_VALUE, 30), RangeError);
});
