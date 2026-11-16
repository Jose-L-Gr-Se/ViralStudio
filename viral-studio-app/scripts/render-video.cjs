#!/usr/bin/env node

const {
  existsSync,
  lstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { basename, dirname, extname, join, resolve } = require("node:path");

const APP_ROOT = resolve(__dirname, "..");
const requireFromApp = createRequire(join(APP_ROOT, "package.json"));
require("./register-typescript.cjs");

const { MEDIA_MANIFEST } = require("../src/video/media/manifest.ts");
const {
  prepareDocumentaryRender,
} = require("../src/video/renderers/documentary/prepare.ts");
const { toFrameTimeline } = require("../src/video/timeline.ts");

const usage = `Usage:
  npm run video:render -- --input <document.json> [--output <video.mp4>] [--overwrite]

Options:
  --input      Video document JSON (required, relative to viral-studio-app/)
  --output     MP4 destination (default: out/videos/<document-id>.mp4)
  --overwrite  Replace an existing output only after the new render is verified
  --help       Show this help
`;

const parseArguments = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help") {
      return { help: true };
    }

    if (argument === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (argument !== "--input" && argument !== "--output") {
      throw new Error(`Unknown option "${argument}".\n\n${usage}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Option "${argument}" requires a value.\n\n${usage}`);
    }

    const key = argument === "--input" ? "input" : "output";
    if (options[key] !== undefined) {
      throw new Error(`Option "${argument}" may only be specified once.`);
    }

    options[key] = value;
    index++;
  }

  if (!options.input) {
    throw new Error(`Option "--input" is required.\n\n${usage}`);
  }

  return options;
};

const describeValidationError = (error) => {
  if (!Array.isArray(error?.issues)) {
    return error instanceof Error ? error.message : String(error);
  }

  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "document";
      return `  ${path}: ${issue.message}`;
    })
    .join("\n");
};

const run = (command, args, options = {}) => {
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
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return Number.NaN;
  }

  return numerator / denominator;
};

const probeAndVerify = (
  videoPath,
  document,
  durationInFrames,
  execute = run,
) => {
  let probe;
  try {
    probe = execute("ffprobe", [
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
  } catch (error) {
    throw new Error(
      `Could not run FFprobe. Install FFmpeg/FFprobe and ensure "ffprobe" is on PATH. ${error.message}`,
    );
  }

  if (probe.status !== 0) {
    throw new Error(`FFprobe failed: ${probe.stderr || probe.stdout}`);
  }

  let metadata;
  try {
    metadata = JSON.parse(probe.stdout);
  } catch (error) {
    throw new Error(`FFprobe returned invalid JSON: ${error.message}`);
  }

  const stream = metadata.streams?.[0];
  if (!stream) {
    throw new Error("FFprobe found no video stream in the rendered MP4.");
  }

  const expectedDuration = durationInFrames / document.fps;
  const actualFrames = Number(stream.nb_read_frames ?? stream.nb_frames);
  const actualDuration = Number(stream.duration);
  const formatDuration = Number(metadata.format?.duration);
  const frameDurationTolerance = 0.5 / document.fps + 0.001;
  const mismatches = [];

  if (stream.codec_name !== "h264") {
    mismatches.push(`codec is "${stream.codec_name}", expected "h264"`);
  }
  if (Number(stream.width) !== document.width) {
    mismatches.push(`width is ${stream.width}, expected ${document.width}`);
  }
  if (Number(stream.height) !== document.height) {
    mismatches.push(`height is ${stream.height}, expected ${document.height}`);
  }
  if (
    Math.abs(parseFrameRate(stream.avg_frame_rate) - document.fps) > 0.001 ||
    Math.abs(parseFrameRate(stream.r_frame_rate) - document.fps) > 0.001
  ) {
    mismatches.push(
      `frame rate is ${stream.avg_frame_rate} (avg) / ${stream.r_frame_rate} (nominal), expected ${document.fps}`,
    );
  }
  if (actualFrames !== durationInFrames) {
    mismatches.push(
      `frame count is ${stream.nb_read_frames ?? stream.nb_frames}, expected ${durationInFrames}`,
    );
  }
  if (
    !Number.isFinite(actualDuration) ||
    Math.abs(actualDuration - expectedDuration) > frameDurationTolerance
  ) {
    mismatches.push(
      `stream duration is ${stream.duration}, expected ${expectedDuration.toFixed(3)} seconds`,
    );
  }
  if (
    !Number.isFinite(formatDuration) ||
    Math.abs(formatDuration - expectedDuration) > frameDurationTolerance
  ) {
    mismatches.push(
      `container duration is ${metadata.format?.duration}, expected ${expectedDuration.toFixed(3)} seconds`,
    );
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Rendered MP4 verification failed:\n${mismatches.join("\n")}`,
    );
  }

  return metadata;
};

const ensureOutputPath = (outputPath, overwrite) => {
  if (!existsSync(outputPath)) {
    return;
  }

  const existing = lstatSync(outputPath);
  if (!existing.isFile()) {
    throw new Error(
      `Output path exists and is not a regular file: "${outputPath}".`,
    );
  }
  if (!overwrite) {
    throw new Error(
      `Output file already exists: "${outputPath}". Use --overwrite to replace it after a successful verified render.`,
    );
  }
};

const publishVerifiedVideo = (temporaryVideoPath, outputPath, overwrite) => {
  if (overwrite) {
    renameSync(temporaryVideoPath, outputPath);
    return;
  }

  try {
    linkSync(temporaryVideoPath, outputPath);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `Output file already exists: "${outputPath}". Use --overwrite to replace it after a successful verified render.`,
      );
    }
    throw error;
  }
};

const renderVideo = ({ input, output, overwrite }, { execute = run } = {}) => {
  const inputPath = resolve(APP_ROOT, input);
  if (!existsSync(inputPath)) {
    throw new Error(`Input document does not exist: "${inputPath}".`);
  }
  if (!statSync(inputPath).isFile()) {
    throw new Error(`Input path is not a regular file: "${inputPath}".`);
  }
  if (extname(inputPath).toLowerCase() !== ".json") {
    throw new Error(
      `Input document must have a .json extension: "${inputPath}".`,
    );
  }

  let documentInput;
  try {
    documentInput = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in "${inputPath}": ${error.message}`);
    }
    throw error;
  }

  let prepared;
  try {
    prepared = prepareDocumentaryRender(documentInput, MEDIA_MANIFEST, {
      mediaRoot: resolve(APP_ROOT, "public", "media"),
    });
  } catch (error) {
    throw new Error(
      `Video document validation or media preparation failed:\n${describeValidationError(error)}`,
    );
  }

  const timeline = toFrameTimeline(prepared.document);
  const outputPath = resolve(
    APP_ROOT,
    output ?? join("out", "videos", `${prepared.document.id}.mp4`),
  );
  if (extname(outputPath).toLowerCase() !== ".mp4") {
    throw new Error(`Output file must have a .mp4 extension: "${outputPath}".`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  ensureOutputPath(outputPath, overwrite);

  const temporaryDirectory = mkdtempSync(
    join(dirname(outputPath), `.${basename(outputPath)}-${randomUUID()}-`),
  );
  const temporaryVideoPath = join(temporaryDirectory, "render.mp4");
  const propsPath = join(temporaryDirectory, "props.json");

  try {
    writeFileSync(propsPath, JSON.stringify(prepared));
    const remotionPackagePath = requireFromApp.resolve(
      "@remotion/cli/package.json",
    );
    const remotionCliPath = join(
      dirname(remotionPackagePath),
      "remotion-cli.js",
    );
    const render = execute(
      process.execPath,
      [
        remotionCliPath,
        "render",
        "src/video/renderers/documentary/DocumentaryRenderRoot.tsx",
        "DocumentaryVideo",
        temporaryVideoPath,
        "--codec",
        "h264",
        "--props",
        propsPath,
        "--log",
        "error",
      ],
      { stdio: "inherit" },
    );
    if (render.status !== 0) {
      throw new Error(
        `Remotion render failed${render.signal ? ` (signal ${render.signal})` : ` (exit code ${render.status})`}.`,
      );
    }

    if (
      !existsSync(temporaryVideoPath) ||
      statSync(temporaryVideoPath).size === 0
    ) {
      throw new Error("Remotion did not produce a non-empty MP4 file.");
    }

    const metadata = probeAndVerify(
      temporaryVideoPath,
      prepared.document,
      timeline.durationInFrames,
      execute,
    );
    publishVerifiedVideo(temporaryVideoPath, outputPath, overwrite);

    return {
      outputPath,
      durationSeconds: timeline.durationInFrames / prepared.document.fps,
      fps: prepared.document.fps,
      width: prepared.document.width,
      height: prepared.document.height,
      frames: timeline.durationInFrames,
      metadata,
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

module.exports = { renderVideo };

const main = () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  const result = renderVideo(options);
  process.stdout.write(
    [
      "Verified MP4 created:",
      `  File: ${result.outputPath}`,
      `  Video: ${result.width}x${result.height}, ${result.fps} FPS, ${result.durationSeconds.toFixed(3)} s, ${result.frames} frames, H.264`,
      "",
    ].join("\n"),
  );
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Video render failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
