import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import "./register-typescript.cjs";

const require = createRequire(import.meta.url);
const { renderVideo } = require("../scripts/render-video.cjs");
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(APP_ROOT, "scripts", "render-video.cjs");
const PROOF_DOCUMENT = join(
  APP_ROOT,
  "tests",
  "fixtures",
  "documentary-proof.json",
);

const createTemporaryDirectory = (testContext) => {
  const directory = mkdtempSync(join(tmpdir(), "viral-video-cli-test-"));
  testContext.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};

const runCli = (...args) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: APP_ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });

const successfulProbe = {
  streams: [
    {
      codec_name: "h264",
      width: 1080,
      height: 1920,
      avg_frame_rate: "30/1",
      r_frame_rate: "30/1",
      duration: "24.000000",
      nb_frames: "720",
      nb_read_frames: "720",
    },
  ],
  format: { duration: "24.000000" },
};

const createSuccessfulExecutor = (onProbe = () => {}) => {
  const renderedPaths = [];

  return {
    renderedPaths,
    execute: (command, args) => {
      if (command === process.execPath) {
        const videoPath = args[4];
        renderedPaths.push(videoPath);
        writeFileSync(videoPath, "verified-render");
        return { status: 0 };
      }

      assert.equal(command, "ffprobe");
      onProbe();
      return {
        status: 0,
        stdout: JSON.stringify(successfulProbe),
        stderr: "",
      };
    },
  };
};

test("CLI rejects a missing input and malformed or invalid JSON", (context) => {
  const directory = createTemporaryDirectory(context);
  const missingInput = runCli("--input", join(directory, "missing.json"));
  assert.equal(missingInput.status, 1);
  assert.match(missingInput.stderr, /Input document does not exist/);

  const malformedPath = join(directory, "malformed.json");
  writeFileSync(malformedPath, "{");
  const malformed = runCli("--input", malformedPath);
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /Invalid JSON/);

  const invalidSchemaPath = join(directory, "invalid-schema.json");
  writeFileSync(invalidSchemaPath, JSON.stringify({ schemaVersion: 2 }));
  const invalidSchema = runCli("--input", invalidSchemaPath);
  assert.equal(invalidSchema.status, 1);
  assert.match(invalidSchema.stderr, /schemaVersion/);
});

test("CLI rejects media declarations that do not match the manifest", (context) => {
  const directory = createTemporaryDirectory(context);
  const document = JSON.parse(readFileSync(PROOF_DOCUMENT, "utf8"));
  document.assets[0].path = "../outside.jpg";
  const inputPath = join(directory, "unsafe-media.json");
  const outputPath = join(directory, "unsafe-media.mp4");
  writeFileSync(inputPath, JSON.stringify(document));

  const result = runCli("--input", inputPath, "--output", outputPath);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /does not match the document's declared kind and path/,
  );
  assert.equal(readdirSync(directory).includes("unsafe-media.mp4"), false);
});

test("CLI refuses to overwrite an existing output by default", (context) => {
  const directory = createTemporaryDirectory(context);
  const outputPath = join(directory, "existing.mp4");
  writeFileSync(outputPath, "original");

  const result = runCli("--input", PROOF_DOCUMENT, "--output", outputPath);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
  assert.equal(readFileSync(outputPath, "utf8"), "original");
});

test("a failed overwrite render preserves the previous output and removes its temporary directory", (context) => {
  const directory = createTemporaryDirectory(context);
  const outputPath = join(directory, "existing.mp4");
  writeFileSync(outputPath, "original");

  assert.throws(
    () =>
      renderVideo(
        { input: PROOF_DOCUMENT, output: outputPath, overwrite: true },
        {
          execute: (_command, args) => {
            writeFileSync(args[4], "partial-render");
            return { status: 1, signal: null };
          },
        },
      ),
    /Remotion render failed/,
  );

  assert.equal(readFileSync(outputPath, "utf8"), "original");
  assert.deepEqual(readdirSync(directory), ["existing.mp4"]);
});

test("FFprobe failure preserves the previous output and removes temporary files", (context) => {
  const directory = createTemporaryDirectory(context);
  const outputPath = join(directory, "existing.mp4");
  writeFileSync(outputPath, "original");

  assert.throws(
    () =>
      renderVideo(
        { input: PROOF_DOCUMENT, output: outputPath, overwrite: true },
        {
          execute: (command, args) => {
            if (command === process.execPath) {
              writeFileSync(args[4], "unverified-render");
              return { status: 0 };
            }

            return { status: 1, stdout: "", stderr: "probe failed" };
          },
        },
      ),
    /FFprobe failed/,
  );

  assert.equal(readFileSync(outputPath, "utf8"), "original");
  assert.deepEqual(readdirSync(directory), ["existing.mp4"]);
});

test("an overwrite is published only after FFprobe verifies the temporary MP4", (context) => {
  const directory = createTemporaryDirectory(context);
  const outputPath = join(directory, "existing.mp4");
  writeFileSync(outputPath, "original");
  const executor = createSuccessfulExecutor(() => {
    assert.equal(readFileSync(outputPath, "utf8"), "original");
  });

  const result = renderVideo(
    { input: PROOF_DOCUMENT, output: outputPath, overwrite: true },
    { execute: executor.execute },
  );

  assert.equal(result.frames, 720);
  assert.equal(readFileSync(outputPath, "utf8"), "verified-render");
  assert.equal(executor.renderedPaths.length, 1);
  assert.deepEqual(readdirSync(directory), ["existing.mp4"]);
});
