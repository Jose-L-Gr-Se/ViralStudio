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
  combineLayerMotion,
  getLayerAnimation,
  getLayerMotion,
  getMediaMotion,
} = require("../src/video/renderers/documentary/motion.ts");
const {
  getLayerStackOrder,
  getMediaLayerLayout,
  getSceneFinishZIndex,
  getTextLayerLayout,
} = require("../src/video/renderers/documentary/layout.ts");
const {
  getSceneTransitionState,
} = require("../src/video/renderers/documentary/transitions.ts");

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

test("uses normalized geometry and enum settings for visual layers", () => {
  const textLayout = getTextLayerLayout({
    id: "positioned-copy",
    type: "text",
    role: "headline",
    text: "Positioned",
    layout: {
      x: 0.1,
      y: 0.2,
      width: 0.7,
      height: 0.25,
      align: "right",
    },
  });
  assert.equal(textLayout.left, "10%");
  assert.equal(textLayout.top, "20%");
  assert.equal(textLayout.width, "70%");
  assert.equal(textLayout.height, "25%");
  assert.equal(textLayout.textAlign, "right");

  const mediaLayout = getMediaLayerLayout("image", {
    x: 0.05,
    y: 0.1,
    width: 0.9,
    height: 0.8,
    fit: "contain",
  });
  assert.equal(mediaLayout.containerStyle.left, "5%");
  assert.equal(mediaLayout.containerStyle.top, "10%");
  assert.equal(mediaLayout.objectFit, "contain");
});

test("preserves default role layouts and media fit behavior", () => {
  assert.deepEqual(
    getTextLayerLayout({
      id: "legacy-headline",
      type: "text",
      role: "headline",
      text: "Legacy",
    }),
    {
      bottom: "19%",
      left: "8%",
      right: "8%",
      textAlign: "center",
    },
  );
  assert.deepEqual(getMediaLayerLayout("illustration", undefined), {
    containerStyle: { inset: "12%" },
    objectFit: "contain",
  });
  assert.deepEqual(getMediaLayerLayout("image", undefined), {
    containerStyle: {},
    objectFit: "cover",
  });
});

test("uses layer array order for stacking without a type priority", () => {
  const layers = [
    {
      id: "copy",
      type: "text",
      role: "headline",
      text: "Text first",
    },
    {
      id: "photo",
      type: "image",
      assetId: "photo-asset",
    },
  ];

  assert.deepEqual(
    getLayerStackOrder(layers).map(({ layer, layerIndex, zIndex }) => [
      layer.id,
      layerIndex,
      zIndex,
    ]),
    [
      ["copy", 0, 0],
      ["photo", 1, 2],
    ],
  );
  assert.equal(getSceneFinishZIndex(layers), 3);
  assert.equal(getSceneFinishZIndex([layers[0]]), -1);
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

test("legacy timing opacity remains unchanged when no animations are configured", () => {
  for (const durationInFrames of [1, 2, 3, 5, 15, 90]) {
    const timing = {
      from: 0,
      durationInFrames,
      enter: {
        preset: "fade",
        durationInFrames: Math.min(15, Math.floor(durationInFrames / 3)),
        legacy: true,
      },
      exit: {
        preset: "fade",
        durationInFrames: Math.min(15, Math.floor(durationInFrames / 3)),
        legacy: true,
      },
    };

    for (let frame = 0; frame < durationInFrames; frame++) {
      assert.equal(
        getLayerAnimation(frame, timing, 40).opacity,
        getLayerMotion("documentary", frame, durationInFrames).opacity,
      );
    }
  }
});

test("media motion presets are deterministic, isotropic, and edge-safe", () => {
  const viewport = { width: 1080, height: 1920 };
  const getMotion = (preset, frame) =>
    getMediaMotion(preset, frame, 90, 0.5, viewport);

  assert.deepEqual(getMotion("static", 0), {
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  assert.deepEqual(getMotion("static", 89), getMotion("static", 0));
  assert.equal(getMotion("push-in", 0).scale, 1);
  assert.equal(getMotion("push-in", 89).scale, 1.03);
  assert.equal(getMotion("pull-out", 0).scale, 1.03);
  assert.equal(getMotion("pull-out", 89).scale, 1);

  const panLeftStart = getMotion("pan-left", 0);
  const panLeftEnd = getMotion("pan-left", 89);
  const panRightStart = getMotion("pan-right", 0);
  const panRightEnd = getMotion("pan-right", 89);
  const maxSafeTravel = (panLeftStart.scale - 1) * viewport.width * 0.5 * 0.8;

  assert.ok(panLeftStart.translateX > 0);
  assert.ok(panLeftEnd.translateX < 0);
  assert.ok(panRightStart.translateX < 0);
  assert.ok(panRightEnd.translateX > 0);
  assert.ok(Math.abs(panLeftStart.translateX) <= maxSafeTravel);
  assert.ok(Math.abs(panLeftEnd.translateX) <= maxSafeTravel);
  assert.equal(panLeftStart.translateY, 0);
  assert.deepEqual(getMotion("pan-left", 45), getMotion("pan-left", 45));
  assert.deepEqual(getMediaMotion("pan-left", 45, 90, 0, viewport), {
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  assert.throws(
    () => getMediaMotion("push-in", 0, 90, 1.1, viewport),
    RangeError,
  );
});

test("layer entry and exit animations interpolate independently", () => {
  const timing = (enterPreset, exitPreset) => ({
    from: 0,
    durationInFrames: 30,
    enter: {
      preset: enterPreset,
      durationInFrames: 6,
      legacy: false,
    },
    exit: {
      preset: exitPreset,
      durationInFrames: 6,
      legacy: false,
    },
  });

  const fadeIn = getLayerAnimation(0, timing("fade", "fade"), 40);
  assert.equal(fadeIn.opacity, 0);
  assert.equal(getLayerAnimation(5, timing("fade", "fade"), 40).opacity, 1);

  const riseIn = getLayerAnimation(0, timing("rise", "fade"), 40);
  assert.equal(riseIn.translateY, 40);
  assert.equal(getLayerAnimation(5, timing("rise", "fade"), 40).translateY, 0);
  assert.deepEqual(
    getLayerAnimation(5, timing("rise", "fade"), 40),
    getLayerAnimation(6, timing("rise", "fade"), 40),
  );

  const scaleIn = getLayerAnimation(0, timing("scale", "fade"), 40);
  assert.equal(scaleIn.scale, 0.96);
  assert.equal(getLayerAnimation(5, timing("scale", "fade"), 40).scale, 1);

  const riseOut = getLayerAnimation(29, timing("fade", "rise"), 40);
  assert.equal(riseOut.opacity, 0);
  assert.equal(riseOut.translateY, -40);
  const scaleOut = getLayerAnimation(29, timing("fade", "scale"), 40);
  assert.equal(scaleOut.scale, 0.96);
  assert.deepEqual(
    getLayerAnimation(23, timing("fade", "scale"), 40),
    getLayerAnimation(24, timing("fade", "scale"), 40),
  );

  const legacyTiming = {
    from: 0,
    durationInFrames: 90,
    enter: { preset: "fade", durationInFrames: 15, legacy: true },
    exit: { preset: "fade", durationInFrames: 15, legacy: true },
  };
  assert.equal(
    getLayerAnimation(0, legacyTiming, 40).opacity,
    getLayerMotion("documentary", 0, 90).opacity,
  );
});

test("combines camera movement with layer transforms and opacity", () => {
  const combined = combineLayerMotion(
    { scale: 1.04, translateX: 12, translateY: -3 },
    { opacity: 0.5, scale: 0.98, translateX: 0, translateY: 20 },
  );

  assert.equal(combined.opacity, 0.5);
  assert.equal(combined.scale, 1.04 * 0.98);
  assert.equal(combined.translateX, 12);
  assert.equal(combined.translateY, 17);
});

test("dissolve, fade, and wipe produce bounded transition states", () => {
  assert.equal(getSceneTransitionState("dissolve", 0).incomingOpacity, 0);
  assert.equal(getSceneTransitionState("dissolve", 0.5).incomingOpacity, 0.5);
  assert.equal(getSceneTransitionState("dissolve", 1).incomingOpacity, 1);

  assert.deepEqual(getSceneTransitionState("fade", 0), {
    incomingOpacity: 0,
    matteOpacity: 0,
    clipPath: undefined,
  });
  assert.deepEqual(getSceneTransitionState("fade", 0.5), {
    incomingOpacity: 0,
    matteOpacity: 1,
    clipPath: undefined,
  });
  assert.deepEqual(getSceneTransitionState("fade", 1), {
    incomingOpacity: 1,
    matteOpacity: 0,
    clipPath: undefined,
  });

  assert.equal(
    getSceneTransitionState("wipe", 0).clipPath,
    "inset(0 100% 0 0)",
  );
  assert.equal(getSceneTransitionState("wipe", 1).clipPath, "inset(0 0% 0 0)");
  assert.throws(() => getSceneTransitionState("wipe", 1.1), RangeError);
});
