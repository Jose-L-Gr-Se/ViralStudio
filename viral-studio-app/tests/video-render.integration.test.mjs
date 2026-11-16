import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const { parseVideoDocument } = require("../src/video/schema.ts");
const { toFrameTimeline } = require("../src/video/timeline.ts");

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_PATH = join(APP_ROOT, "videos", "field-to-table-story.json");
const OUTPUT_DIRECTORY = join(
  APP_ROOT,
  "out",
  "tests",
  `video-render-${randomUUID()}`,
);
const OUTPUT_PATH = join(OUTPUT_DIRECTORY, "field-to-table-story.mp4");
const DOCUMENT = parseVideoDocument(
  JSON.parse(readFileSync(INPUT_PATH, "utf8")),
);
const DURATION_IN_FRAMES = toFrameTimeline(DOCUMENT).durationInFrames;

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

const parseFrameRate = (value) => {
  const [numerator, denominator] = String(value).split("/").map(Number);
  return numerator / denominator;
};

test(
  "renders a new JSON video with the generic documentary CLI and verifies its MP4",
  { timeout: 600_000 },
  (context) => {
    let verified = false;

    try {
      mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      assert.equal(existsSync(OUTPUT_PATH), false);

      const render = runCommand(
        process.execPath,
        [
          "scripts/render-video.cjs",
          "--input",
          INPUT_PATH,
          "--output",
          OUTPUT_PATH,
        ],
        { timeout: 540_000 },
      );
      assert.equal(
        render.status,
        0,
        `Video CLI failed:\n${render.stdout}\n${render.stderr}`,
      );
      assert.match(render.stdout, /Verified MP4 created/);
      assert.equal(existsSync(OUTPUT_PATH), true);
      assert.ok(statSync(OUTPUT_PATH).size > 100_000);

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
        OUTPUT_PATH,
      ]);
      assert.equal(
        probe.status,
        0,
        `FFprobe failed:\n${probe.stdout}\n${probe.stderr}`,
      );

      const metadata = JSON.parse(probe.stdout);
      const stream = metadata.streams?.[0];
      assert.ok(stream, "FFprobe should find a video stream");
      assert.equal(stream.codec_name, "h264");
      assert.equal(Number(stream.width), DOCUMENT.width);
      assert.equal(Number(stream.height), DOCUMENT.height);
      assert.equal(parseFrameRate(stream.avg_frame_rate), DOCUMENT.fps);
      assert.equal(parseFrameRate(stream.r_frame_rate), DOCUMENT.fps);
      assert.equal(Number(stream.nb_read_frames), DURATION_IN_FRAMES);
      assert.equal(Number(stream.nb_frames), DURATION_IN_FRAMES);

      const expectedDuration = DURATION_IN_FRAMES / DOCUMENT.fps;
      const durationTolerance = 0.5 / DOCUMENT.fps + 0.001;
      assert.ok(
        Math.abs(Number(stream.duration) - expectedDuration) <
          durationTolerance,
      );
      assert.ok(
        Math.abs(Number(metadata.format.duration) - expectedDuration) <
          durationTolerance,
      );

      writeFileSync(
        join(OUTPUT_DIRECTORY, "ffprobe.json"),
        JSON.stringify(metadata, null, 2),
      );
      verified = true;
      context.diagnostic(`Verified MP4: ${OUTPUT_PATH}`);
      context.diagnostic(
        `FFprobe metadata: ${join(OUTPUT_DIRECTORY, "ffprobe.json")}`,
      );
    } finally {
      if (!verified) {
        rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
      }
    }
  },
);
