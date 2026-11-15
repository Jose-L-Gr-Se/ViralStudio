import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const {
  prepareDocumentaryRender,
} = require("../src/video/renderers/documentary/prepare.ts");
const {
  getLayerMotion,
} = require("../src/video/renderers/documentary/motion.ts");

const illustrationAsset = {
  id: "scene-photo",
  kind: "illustration",
  path: "images/scene.svg",
  provenance: { type: "original", source: "Synthetic test fixture" },
  license: "CC0-1.0",
  credits: "Viral Studio test",
  altText: "A geometric test illustration.",
  focalPoint: { x: 0.5, y: 0.4 },
};

const makeDocument = () => ({
  schemaVersion: 1,
  id: "documentary-test",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 2,
  themeId: "forest-editorial",
  assets: [
    {
      id: illustrationAsset.id,
      kind: illustrationAsset.kind,
      path: illustrationAsset.path,
    },
  ],
  scenes: [
    {
      id: "scene-one",
      timing: { startSeconds: 0, durationSeconds: 2 },
      format: "documentary",
      layers: [
        {
          id: "illustration-layer",
          type: "illustration",
          assetId: illustrationAsset.id,
        },
        {
          id: "headline-layer",
          type: "text",
          role: "headline",
          text: "A test headline",
        },
      ],
    },
  ],
});

const withMediaRoot = (callback) => {
  const workspace = mkdtempSync(join(tmpdir(), "viral-studio-documentary-"));
  const mediaRoot = join(workspace, "public", "media");
  const imagePath = join(mediaRoot, illustrationAsset.path);
  mkdirSync(dirname(imagePath), { recursive: true });
  writeFileSync(
    imagePath,
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2f5d41"/></svg>',
  );

  try {
    callback(mediaRoot);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
};

test("prepares documentary media as serializable public paths only", () => {
  withMediaRoot((mediaRoot) => {
    const prepared = prepareDocumentaryRender(
      makeDocument(),
      { schemaVersion: 1, assets: [illustrationAsset] },
      { mediaRoot },
    );

    assert.equal(prepared.document.id, "documentary-test");
    assert.deepEqual(prepared.media, [
      {
        id: "scene-photo",
        kind: "illustration",
        publicPath: "media/images/scene.svg",
        altText: "A geometric test illustration.",
        focalPoint: { x: 0.5, y: 0.4 },
      },
    ]);
    assert.equal("absolutePath" in prepared.media[0], false);
  });
});

test("rejects unsupported scene formats, layers, and themes", () => {
  const editorialDocument = makeDocument();
  editorialDocument.scenes[0].format = "editorial";
  assert.throws(
    () =>
      prepareDocumentaryRender(editorialDocument, {
        schemaVersion: 1,
        assets: [illustrationAsset],
      }),
    /does not support scene format "editorial"/,
  );

  const chartDocument = makeDocument();
  chartDocument.scenes[0].layers[0] = {
    id: "chart-layer",
    type: "chart",
    title: "Unsupported chart",
    data: [{ label: "A", value: 1 }],
  };
  assert.throws(
    () =>
      prepareDocumentaryRender(chartDocument, {
        schemaVersion: 1,
        assets: [illustrationAsset],
      }),
    /does not support layer type "chart"/,
  );

  const invalidThemeDocument = makeDocument();
  invalidThemeDocument.themeId = "unknown-theme";
  assert.throws(() =>
    prepareDocumentaryRender(invalidThemeDocument, {
      schemaVersion: 1,
      assets: [illustrationAsset],
    }),
  );
});

test("fails preparation when a referenced local media file is missing", () => {
  const workspace = mkdtempSync(join(tmpdir(), "viral-studio-documentary-"));
  const mediaRoot = join(workspace, "public", "media");

  try {
    mkdirSync(mediaRoot, { recursive: true });
    assert.throws(
      () =>
        prepareDocumentaryRender(
          makeDocument(),
          { schemaVersion: 1, assets: [illustrationAsset] },
          { mediaRoot },
        ),
      /does not exist/,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("documentary motion animates zoom, pan, and bounded fades", () => {
  const firstFrame = getLayerMotion("documentary", 0, 90);
  const middleFrame = getLayerMotion("documentary", 45, 90);
  const lastFrame = getLayerMotion("documentary", 89, 90);

  assert.equal(firstFrame.opacity, 0);
  assert.equal(middleFrame.opacity, 1);
  assert.equal(lastFrame.opacity, 0);
  assert.ok(firstFrame.scale < middleFrame.scale);
  assert.ok(middleFrame.scale < lastFrame.scale);
  assert.notEqual(firstFrame.translateX, lastFrame.translateX);
  assert.throws(() => getLayerMotion("documentary", -1, 90), RangeError);
  assert.throws(() => getLayerMotion("documentary", 0, 0), RangeError);
});
