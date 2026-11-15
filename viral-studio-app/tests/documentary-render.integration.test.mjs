import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const {
  prepareDocumentaryRender,
} = require("../src/video/renderers/documentary/prepare.ts");

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const WIDTH = 360;
const HEIGHT = 640;

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

const crc32 = (data) => {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, "ascii");
  const checksum = crc32(Buffer.concat([typeBytes, data]));
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(checksum, 8 + data.length);
  return chunk;
};

const createSyntheticImage = (imagePath) => {
  const rowLength = WIDTH * 3 + 1;
  const pixels = Buffer.alloc(rowLength * HEIGHT);

  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * rowLength;
    const verticalProgress = y / HEIGHT;
    pixels[rowStart] = 0;

    for (let x = 0; x < WIDTH; x += 1) {
      const offset = rowStart + 1 + x * 3;
      const farHill = HEIGHT * 0.66 + Math.sin(x / 34) * 18;
      const nearHill = HEIGHT * 0.76 + Math.sin(x / 51 + 1.2) * 25;
      const sunX = WIDTH * 0.5;
      const sunY = HEIGHT * 0.34;
      const isSun = Math.hypot(x - sunX, y - sunY) < WIDTH * 0.14;

      let red = Math.round(20 + verticalProgress * 13);
      let green = Math.round(45 + verticalProgress * 27);
      let blue = Math.round(35 + verticalProgress * 13);

      if (y > farHill) {
        [red, green, blue] = [58, 105, 69];
      }
      if (y > nearHill) {
        [red, green, blue] = [31, 70, 47];
      }
      if (isSun) {
        [red, green, blue] = [226, 190, 130];
      }

      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(imagePath, png);
};

const runCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: APP_ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
};

test(
  "renders a valid local-image documentary JSON document to H.264 MP4",
  { timeout: 300_000 },
  (context) => {
    const mediaRoot = join(APP_ROOT, "public", "media");
    mkdirSync(mediaRoot, { recursive: true });
    const fixtureDirectory = mkdtempSync(
      join(mediaRoot, "documentary-integration-"),
    );
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "viral-studio-documentary-integration-"),
    );
    const outputDirectory = join(
      APP_ROOT,
      "out",
      "tests",
      `documentary-integration-${randomUUID()}`,
    );
    const imagePath = join(fixtureDirectory, "synthetic-forest.png");
    const relativeAssetPath = relative(mediaRoot, imagePath)
      .split(sep)
      .join("/");
    const renderOutputPath = join(
      outputDirectory,
      "viral-studio-documentary-integration.mp4",
    );
    let renderedAndVerified = false;

    try {
      mkdirSync(outputDirectory, { recursive: true });
      createSyntheticImage(imagePath);

      const manifest = {
        schemaVersion: 1,
        assets: [
          {
            id: "integration-forest-image",
            kind: "image",
            path: relativeAssetPath,
            provenance: {
              type: "original",
              source: "Generated locally by the Viral Studio integration test.",
            },
            license: "CC0-1.0",
            credits: "Viral Studio synthetic integration fixture",
            altText:
              "Synthetic geometric forest landscape generated for a renderer test.",
            focalPoint: { x: 0.5, y: 0.45 },
          },
        ],
      };
      const document = {
        schemaVersion: 1,
        id: "documentary-integration-video",
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 9,
        themeId: "forest-editorial",
        assets: [
          {
            id: "integration-forest-image",
            kind: "image",
            path: relativeAssetPath,
          },
        ],
        scenes: [
          {
            id: "documentary-integration-scene",
            timing: { startSeconds: 0, durationSeconds: 9 },
            format: "documentary",
            layers: [
              {
                id: "integration-image-layer",
                type: "image",
                assetId: "integration-forest-image",
              },
              {
                id: "integration-caption",
                type: "text",
                role: "caption",
                text: "VIRAL STUDIO / PRUEBA LOCAL",
              },
              {
                id: "integration-headline",
                type: "text",
                role: "headline",
                text: "Cultiva un futuro mejor",
              },
              {
                id: "integration-body",
                type: "text",
                role: "body",
                text: "Cada elección puede nutrir el mañana.",
              },
            ],
          },
        ],
      };
      const documentPath = join(temporaryDirectory, "document.json");
      const manifestPath = join(temporaryDirectory, "manifest.json");
      const propsPath = join(temporaryDirectory, "input-props.json");
      writeFileSync(documentPath, JSON.stringify(document, null, 2));
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const documentFromJson = JSON.parse(readFileSync(documentPath, "utf8"));
      const manifestFromJson = JSON.parse(readFileSync(manifestPath, "utf8"));
      const prepared = prepareDocumentaryRender(
        documentFromJson,
        manifestFromJson,
        { mediaRoot },
      );
      assert.equal(prepared.media[0].publicPath, `media/${relativeAssetPath}`);
      assert.equal("absolutePath" in prepared.media[0], false);
      writeFileSync(propsPath, JSON.stringify(prepared));

      const remotionBinary = join(
        APP_ROOT,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "remotion.cmd" : "remotion",
      );
      const render = runCommand(
        remotionBinary,
        [
          "render",
          "src/index.ts",
          "DocumentaryPreview",
          renderOutputPath,
          "--codec",
          "h264",
          "--props",
          propsPath,
          "--log",
          "error",
        ],
        { timeout: 240_000 },
      );

      assert.equal(
        render.status,
        0,
        `Remotion render failed:\n${render.stdout}\n${render.stderr}`,
      );
      assert.equal(existsSync(renderOutputPath), true);
      assert.ok(statSync(renderOutputPath).size > 10_000);

      const probe = runCommand("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,avg_frame_rate",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        renderOutputPath,
      ]);
      assert.equal(
        probe.status,
        0,
        `FFprobe failed:\n${probe.stdout}\n${probe.stderr}`,
      );

      const metadata = JSON.parse(probe.stdout);
      assert.equal(metadata.streams.length, 1);
      assert.equal(metadata.streams[0].codec_name, "h264");
      assert.equal(metadata.streams[0].width, 1080);
      assert.equal(metadata.streams[0].height, 1920);
      assert.equal(metadata.streams[0].avg_frame_rate, "30/1");
      assert.ok(Math.abs(Number(metadata.format.duration) - 9) < 0.05);

      renderedAndVerified = true;
      context.diagnostic(`Verified MP4: ${renderOutputPath}`);
    } finally {
      rmSync(fixtureDirectory, { recursive: true, force: true });
      rmSync(temporaryDirectory, { recursive: true, force: true });
      if (!renderedAndVerified) {
        rmSync(outputDirectory, { recursive: true, force: true });
      }
    }
  },
);
