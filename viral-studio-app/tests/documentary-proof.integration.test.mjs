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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const { MEDIA_MANIFEST } = require("../src/video/media/manifest.ts");
const {
  prepareDocumentaryRender,
} = require("../src/video/renderers/documentary/prepare.ts");

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE_PATH = join(
  APP_ROOT,
  "tests",
  "fixtures",
  "documentary-proof.json",
);
const VIDEO_DURATION_SECONDS = 24;
const FPS = 30;
const VIDEO_FRAMES = VIDEO_DURATION_SECONDS * FPS;
const FRAME_SAMPLES = [
  { scene: 1, seconds: 1.5, frame: 45, label: "scene-1-early" },
  { scene: 1, seconds: 4.5, frame: 135, label: "scene-1-middle" },
  { scene: 1, seconds: 7.5, frame: 225, label: "scene-1-late" },
  { scene: 2, seconds: 8, frame: 240, label: "dissolve-start" },
  { scene: 2, seconds: 8.4, frame: 252, label: "dissolve-middle" },
  { scene: 2, seconds: 8.77, frame: 263, label: "dissolve-end" },
  { scene: 2, seconds: 9.5, frame: 285, label: "scene-2-early" },
  { scene: 2, seconds: 12, frame: 360, label: "scene-2-middle" },
  { scene: 2, seconds: 15.5, frame: 465, label: "scene-2-late" },
  { scene: 3, seconds: 16, frame: 480, label: "wipe-start" },
  { scene: 3, seconds: 16.35, frame: 490, label: "wipe-middle" },
  { scene: 3, seconds: 16.67, frame: 500, label: "wipe-end" },
  { scene: 3, seconds: 17.5, frame: 525, label: "scene-3-early" },
  { scene: 3, seconds: 20.5, frame: 615, label: "scene-3-middle" },
  { scene: 3, seconds: 23.5, frame: 705, label: "scene-3-late" },
];

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
  "renders a 24-second documentary proof with local licensed photos and visual samples",
  { timeout: 600_000 },
  (context) => {
    const document = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
    const prepared = prepareDocumentaryRender(document, MEDIA_MANIFEST);
    const outputDirectory = join(
      APP_ROOT,
      "out",
      "tests",
      `documentary-proof-${randomUUID()}`,
    );
    const framesDirectory = join(outputDirectory, "frames");
    const videoPath = join(
      outputDirectory,
      "viral-studio-documentary-proof.mp4",
    );
    const propsPath = join(outputDirectory, "prepared-document.json");
    const samplesPath = join(outputDirectory, "frame-samples.json");
    const contactSheetPath = join(outputDirectory, "contact-sheet.jpg");
    let renderedAndVerified = false;

    try {
      assert.equal(document.durationSeconds, VIDEO_DURATION_SECONDS);
      assert.equal(document.fps, FPS);
      assert.equal(document.width, 1080);
      assert.equal(document.height, 1920);
      assert.equal(document.scenes.length, 3);
      assert.deepEqual(
        document.scenes.map((scene) => scene.transitionIn?.type ?? "cut"),
        ["cut", "dissolve", "wipe"],
      );
      assert.ok(
        prepared.media.every((asset) =>
          existsSync(join(APP_ROOT, "public", asset.publicPath)),
        ),
      );
      assert.deepEqual(
        prepared.media.map((asset) => asset.focalPoint),
        [
          { x: 0.5, y: 0.42 },
          { x: 0.5, y: 0.55 },
          { x: 0.68, y: 0.5 },
        ],
      );

      mkdirSync(framesDirectory, { recursive: true });
      writeFileSync(propsPath, JSON.stringify(prepared, null, 2));
      writeFileSync(samplesPath, JSON.stringify(FRAME_SAMPLES, null, 2));

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
          "tests/DocumentaryProofRoot.tsx",
          "DocumentaryProof",
          videoPath,
          "--codec",
          "h264",
          "--props",
          propsPath,
          "--log",
          "error",
        ],
        { timeout: 540_000 },
      );

      assert.equal(
        render.status,
        0,
        `Documentary render failed:\n${render.stdout}\n${render.stderr}`,
      );
      assert.equal(existsSync(videoPath), true);
      assert.ok(statSync(videoPath).size > 100_000);

      const probe = runCommand("ffprobe", [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_frames,nb_read_frames",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        videoPath,
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
      assert.equal(metadata.streams[0].r_frame_rate, "30/1");
      assert.equal(Number(metadata.streams[0].nb_frames), VIDEO_FRAMES);
      assert.equal(Number(metadata.streams[0].nb_read_frames), VIDEO_FRAMES);
      assert.ok(
        Math.abs(
          Number(metadata.streams[0].duration) - VIDEO_DURATION_SECONDS,
        ) < 0.05,
      );
      assert.ok(
        Math.abs(Number(metadata.format.duration) - VIDEO_DURATION_SECONDS) <
          0.05,
      );
      writeFileSync(
        join(outputDirectory, "ffprobe.json"),
        JSON.stringify(metadata, null, 2),
      );

      const selectFrames = FRAME_SAMPLES.map(
        ({ frame }) => `eq(n,${frame})`,
      ).join("+");
      const extraction = runCommand("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        videoPath,
        "-vf",
        `select='${selectFrames}'`,
        "-fps_mode",
        "vfr",
        "-q:v",
        "2",
        join(framesDirectory, "frame-%02d.jpg"),
      ]);
      assert.equal(
        extraction.status,
        0,
        `Frame extraction failed:\n${extraction.stdout}\n${extraction.stderr}`,
      );

      const frameFiles = FRAME_SAMPLES.map((_, index) =>
        join(
          framesDirectory,
          `frame-${String(index + 1).padStart(2, "0")}.jpg`,
        ),
      );
      for (const framePath of frameFiles) {
        assert.equal(existsSync(framePath), true, `Missing ${framePath}`);
        assert.ok(statSync(framePath).size > 10_000);
      }

      const contactSheet = runCommand("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-pattern_type",
        "glob",
        "-i",
        join(framesDirectory, "frame-*.jpg"),
        "-vf",
        "scale=324:576:force_original_aspect_ratio=decrease,pad=324:576:(ow-iw)/2:(oh-ih)/2,tile=3x5:margin=12:padding=12:color=0x202820",
        "-frames:v",
        "1",
        contactSheetPath,
      ]);
      assert.equal(
        contactSheet.status,
        0,
        `Contact sheet generation failed:\n${contactSheet.stdout}\n${contactSheet.stderr}`,
      );
      assert.ok(statSync(contactSheetPath).size > 10_000);

      renderedAndVerified = true;
      context.diagnostic(`Verified MP4: ${videoPath}`);
      context.diagnostic(`Contact sheet: ${contactSheetPath}`);
      context.diagnostic(`Extracted frames: ${framesDirectory}`);
    } finally {
      if (!renderedAndVerified) {
        rmSync(outputDirectory, { recursive: true, force: true });
      }
    }
  },
);
