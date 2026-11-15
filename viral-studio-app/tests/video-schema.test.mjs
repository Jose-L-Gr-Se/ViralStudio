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
