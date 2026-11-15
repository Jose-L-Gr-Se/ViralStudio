import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const {
  getTheme,
  parseThemeCatalog,
  THEME_CATALOG,
  ThemeCatalogSchema,
} = require("../src/video/themes/catalog.ts");
const { ThemeSchema } = require("../src/video/themes/schema.ts");
const {
  MediaAssetSchema,
  MediaManifestSchema,
  parseMediaManifest,
} = require("../src/video/media/schema.ts");
const {
  resolveMediaAsset,
  resolveVideoMedia,
} = require("../src/video/media/resolve.ts");
const { MEDIA_MANIFEST } = require("../src/video/media/manifest.ts");

const mediaAssetFixtures = [
  {
    id: "leaf-photo",
    kind: "image",
    path: "images/leaf.png",
    provenance: { type: "original", source: "Local test fixture" },
    license: "CC0-1.0",
    credits: "Viral Studio",
    altText: "A leaf in natural light.",
    focalPoint: { x: 0.5, y: 0.4 },
  },
  {
    id: "sprout-illustration",
    kind: "illustration",
    path: "illustrations/sprout.svg",
    provenance: { type: "user-provided", source: "Local test fixture" },
    license: "MIT",
    credits: "Viral Studio",
    altText: "A simple sprout illustration.",
    focalPoint: { x: 0.5, y: 0.5 },
  },
  {
    id: "garden-video",
    kind: "video",
    path: "video/garden.mp4",
    provenance: { type: "original", source: "Local test fixture" },
    license: "CC0-1.0",
    credits: "Viral Studio",
    altText: "A garden in the morning.",
  },
  {
    id: "forest-audio",
    kind: "audio",
    path: "audio/forest.wav",
    provenance: { type: "original", source: "Local test fixture" },
    license: "CC0-1.0",
    credits: "Viral Studio",
    altText: "Quiet forest ambience.",
  },
];

const makeManifest = () => ({
  schemaVersion: 1,
  assets: mediaAssetFixtures.map((asset) => ({ ...asset })),
});

const makeVideoDocument = (manifest = makeManifest()) => ({
  schemaVersion: 1,
  id: "sustainability-video",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 5,
  themeId: "forest-editorial",
  assets: manifest.assets.map(({ id, kind, path }) => ({ id, kind, path })),
  scenes: [
    {
      id: "opening-scene",
      timing: { startSeconds: 0, durationSeconds: 5 },
      format: "documentary",
      layers: [
        {
          id: "opening-title",
          type: "text",
          role: "headline",
          text: "A sustainable future",
        },
        ...manifest.assets.map((asset) => ({
          id: `layer-${asset.id}`,
          type: asset.kind,
          assetId: asset.id,
        })),
      ],
    },
  ],
});

const withMediaRoot = (callback) => {
  const workspace = mkdtempSync(join(tmpdir(), "viral-studio-media-"));
  const mediaRoot = join(workspace, "public", "media");
  mkdirSync(mediaRoot, { recursive: true });

  for (const asset of mediaAssetFixtures) {
    const assetPath = join(mediaRoot, asset.path);
    mkdirSync(dirname(assetPath), { recursive: true });
    writeFileSync(assetPath, "Temporary media fixture");
  }

  try {
    callback({ mediaRoot, workspace });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
};

test("provides four valid themes with no scene layout fields", () => {
  const ids = [
    "forest-editorial",
    "cinematic-dark",
    "scientific",
    "natural-product",
  ];

  assert.deepEqual(Object.keys(THEME_CATALOG), ids);
  assert.equal(ThemeCatalogSchema.safeParse(THEME_CATALOG).success, true);

  for (const id of ids) {
    const theme = getTheme(id);
    assert.equal(ThemeSchema.safeParse(theme).success, true);
    assert.equal("layout" in theme, false);
  }
});

test("rejects unknown theme IDs and malformed theme tokens", () => {
  assert.throws(() => getTheme("unknown-theme"));

  const invalidColor = {
    ...THEME_CATALOG["forest-editorial"],
    colors: {
      ...THEME_CATALOG["forest-editorial"].colors,
      brand: "forest-green",
    },
  };
  assert.equal(ThemeSchema.safeParse(invalidColor).success, false);

  const invalidScale = {
    ...THEME_CATALOG["forest-editorial"],
    typeScale: {
      ...THEME_CATALOG["forest-editorial"].typeScale,
      headline: 0,
    },
  };
  assert.equal(ThemeSchema.safeParse(invalidScale).success, false);

  const layoutInTheme = {
    ...THEME_CATALOG["forest-editorial"],
    layout: { columns: 2 },
  };
  assert.equal(ThemeSchema.safeParse(layoutInTheme).success, false);
});

test("rejects incomplete or invalid theme catalogs", () => {
  const incompleteCatalog = { ...THEME_CATALOG };
  delete incompleteCatalog.scientific;
  assert.equal(ThemeCatalogSchema.safeParse(incompleteCatalog).success, false);

  const invalidCatalog = {
    ...THEME_CATALOG,
    scientific: {
      ...THEME_CATALOG.scientific,
      finishes: { ...THEME_CATALOG.scientific.finishes, grain: 2 },
    },
  };
  assert.equal(ThemeCatalogSchema.safeParse(invalidCatalog).success, false);
  assert.equal(
    parseThemeCatalog(THEME_CATALOG)["forest-editorial"].colors.brand,
    "#2f5d41",
  );
});

test("provides an empty versioned media manifest until local assets are added", () => {
  assert.deepEqual(MEDIA_MANIFEST, { schemaVersion: 1, assets: [] });
  assert.equal(MediaManifestSchema.safeParse(MEDIA_MANIFEST).success, true);
});

test("validates asset metadata, focal points, and unique manifest IDs", () => {
  const manifest = makeManifest();
  assert.equal(MediaManifestSchema.safeParse(manifest).success, true);

  const duplicateIds = makeManifest();
  duplicateIds.assets.push({ ...duplicateIds.assets[0] });
  assert.equal(MediaManifestSchema.safeParse(duplicateIds).success, false);

  const missingMetadata = { ...manifest.assets[0] };
  delete missingMetadata.credits;
  assert.equal(MediaAssetSchema.safeParse(missingMetadata).success, false);

  const blankLicense = { ...manifest.assets[0], license: "   " };
  assert.equal(MediaAssetSchema.safeParse(blankLicense).success, false);

  const invalidFocalPoint = {
    ...manifest.assets[0],
    focalPoint: { x: 1.1, y: 0.5 },
  };
  assert.equal(MediaAssetSchema.safeParse(invalidFocalPoint).success, false);
});

test("resolves existing referenced assets of each supported kind", () => {
  withMediaRoot(({ mediaRoot }) => {
    const manifest = makeManifest();
    const resolved = resolveVideoMedia(makeVideoDocument(manifest), manifest, {
      mediaRoot,
    });

    assert.equal(resolved.size, 4);
    assert.equal(
      resolved.get("leaf-photo").publicPath,
      "media/images/leaf.png",
    );
    assert.equal(
      resolved.get("sprout-illustration").publicPath,
      "media/illustrations/sprout.svg",
    );
    assert.equal(
      resolved.get("garden-video").publicPath,
      "media/video/garden.mp4",
    );
    assert.equal(
      resolved.get("forest-audio").publicPath,
      "media/audio/forest.wav",
    );
  });
});

test("rejects missing resources and manifest/document mismatches", () => {
  withMediaRoot(({ mediaRoot }) => {
    const manifest = makeManifest();
    const document = makeVideoDocument(manifest);
    rmSync(join(mediaRoot, "video/garden.mp4"));
    assert.throws(
      () => resolveVideoMedia(document, manifest, { mediaRoot }),
      /does not exist/,
    );
  });

  withMediaRoot(({ mediaRoot }) => {
    const manifest = makeManifest();
    manifest.assets[0].path = "images/other.png";
    assert.throws(
      () =>
        resolveVideoMedia(makeVideoDocument(makeManifest()), manifest, {
          mediaRoot,
        }),
      /does not match the document/,
    );
  });

  withMediaRoot(({ mediaRoot }) => {
    const manifest = makeManifest();
    const document = makeVideoDocument(manifest);
    manifest.assets.push({
      ...manifest.assets[0],
      id: "opening-title",
    });
    assert.throws(
      () => resolveVideoMedia(document, manifest, { mediaRoot }),
      /collides with a video, scene, or layer id/,
    );
  });
});

test("rejects traversal, absolute, remote, and symlink-escaping paths", () => {
  withMediaRoot(({ mediaRoot, workspace }) => {
    const asset = makeManifest().assets[0];
    const unsafePaths = [
      "../outside.png",
      "/tmp/outside.png",
      "C:\\outside.png",
      "https://example.test/leaf.png",
      "images/%2e%2e/outside.png",
      "images/../outside.png",
    ];

    for (const path of unsafePaths) {
      assert.throws(
        () => resolveMediaAsset({ ...asset, path }, mediaRoot),
        /unsafe path/,
      );
    }

    const outsidePath = join(workspace, "outside.png");
    writeFileSync(outsidePath, "Outside the media root");
    symlinkSync(outsidePath, join(mediaRoot, "images/linked.png"));
    assert.throws(
      () =>
        resolveMediaAsset({ ...asset, path: "images/linked.png" }, mediaRoot),
      /outside the permitted media root/,
    );
  });
});

test("rejects missing files, incompatible extensions, and invalid manifests", () => {
  withMediaRoot(({ mediaRoot }) => {
    const asset = makeManifest().assets[0];

    assert.throws(
      () =>
        resolveMediaAsset({ ...asset, path: "images/missing.png" }, mediaRoot),
      /does not exist/,
    );
    assert.throws(
      () =>
        resolveMediaAsset({ ...asset, path: "video/garden.mp4" }, mediaRoot),
      /invalid for kind "image"/,
    );
    assert.throws(
      () => resolveMediaAsset({ ...asset, path: "images/leaf.gif" }, mediaRoot),
      /invalid for kind "image"/,
    );
  });

  const invalidVersion = makeManifest();
  invalidVersion.schemaVersion = 2;
  assert.equal(MediaManifestSchema.safeParse(invalidVersion).success, false);

  const invalidProvenance = makeManifest();
  assert.equal(
    parseMediaManifest(invalidProvenance).assets.length,
    mediaAssetFixtures.length,
  );
  invalidProvenance.assets[0].provenance.source = "";
  assert.equal(MediaManifestSchema.safeParse(invalidProvenance).success, false);
});
