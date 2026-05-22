# video-sampler

Extract WAV audio and adaptive, non-duplicate sample frames from video files.

`video-sampler` is a Node.js package and CLI for extracting useful media outputs from video files. It can:

- extract clean WAV audio from a video
- sample representative visual frames across the full video
- avoid near-duplicate frames with perceptual image hashing
- reject mostly black, mostly white, or very low-information frames
- work with bundled FFmpeg/FFprobe binaries or custom binary paths

It is useful when you need audio, representative frames, or both from a video. Common use cases include video previews, media indexing, moderation pipelines, content analysis, scene sampling, presentation recordings, interview recordings, video resumes, async assessments, and any workflow where processing every frame would be wasteful.

## Table of Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [CLI](#cli)
  - [Library](#library)
- [Demo](#demo)
- [What It Does](#what-it-does)
  - [Audio Extraction](#audio-extraction)
  - [Frame Sampling](#frame-sampling)
- [CLI Usage](#cli-usage)
  - [CLI Options](#cli-options)
  - [CLI Examples](#cli-examples)
- [Library API](#library-api)
  - [`extractAudio(videoPath, options)`](#extractaudiovideopath-options)
  - [`sampleFrames(videoPath, options)`](#sampleframesvideopath-options)
  - [Frame Result](#frame-result)
- [Common Recipes](#common-recipes)
- [Error Handling](#error-handling)
- [Notes](#notes)
- [License](#license)

## Installation

```bash
npm install video-sampler
```

## Requirements

This package is ESM-only.

Use ESM imports:

```js
import { extractAudio, sampleFrames } from 'video-sampler';
```

If your project uses CommonJS, use dynamic `import()`:

```js
async function main() {
  const { extractAudio, sampleFrames } = await import('video-sampler');
}
```

It includes default FFmpeg and FFprobe binaries through:

- `@ffmpeg-installer/ffmpeg`
- `@ffprobe-installer/ffprobe`

Advanced users can pass custom `ffmpegPath` and `ffprobePath` values if they want to use system-installed binaries or a specific FFmpeg build.

## Quick Start

### CLI

```bash
npx video-sampler ./video.webm
```

By default, the CLI writes:

- WAV audio to `./audio`
- accepted frame images to `./frames`

Example with custom outputs:

```bash
npx video-sampler ./video.mp4 --audio-dir ./output/audio --frames-dir ./output/frames --frames 20 --similarity-threshold 10 --min-gap-ms 1000
```

### Library

```js
import { extractAudio, sampleFrames } from 'video-sampler';

const audio = await extractAudio('./video.webm', {
  outputDir: './output/audio',
});

const frames = await sampleFrames('./video.webm', {
  outputDir: './output/frames',
  targetFrames: 20,
  similarityThreshold: 10,
  minGapMs: 1000,
});

console.log(audio.path);
console.log(frames.frames.map((frame) => frame.path));
```

Only need frames:

```js
import { sampleFrames } from 'video-sampler';

const result = await sampleFrames('./video.mp4', {
  outputDir: './frames',
  targetFrames: 30,
  minGapMs: 100,
  similarityThreshold: 5,
});

console.log(result.frames.map((frame) => frame.path));
```

## Demo

This demo uses a lecture video, where most of the useful visual information is in presentation slides.

[<img src="https://raw.githubusercontent.com/vedangdanej/video-sampler/main/demo/thumbnail.jpg" alt="Watch the MIT lecture video used for the video-sampler demo" width="720">](https://www.youtube.com/watch?v=4fTOrb1yBFU)

Command:

```bash
npx video-sampler ./video.mp4 --target-frames 15 --min-gap 500 --similarity-threshold 7
```

Output: 10 representative frames. `similarityThreshold` is set to `7` so progressive slide reveals are not filtered too aggressively.

<img src="https://raw.githubusercontent.com/vedangdanej/video-sampler/main/demo/frame-grid.jpg" alt="10 representative demo frames extracted by video-sampler" width="760">

## What It Does

### Audio Extraction

`extractAudio()` converts the input video's audio track into a WAV file.

The generated WAV is:

- PCM signed 16-bit little-endian
- 16 kHz
- mono
- MIME type `audio/wav`

This is a practical format for speech-to-text, transcription, audio indexing, and other audio analysis systems.

### Frame Sampling

`sampleFrames()` does not simply take one frame every N seconds.

Instead, it:

1. probes video duration and metadata with FFprobe
2. calculates a realistic frame target based on duration and options
3. generates more candidate timestamps than the final target
4. extracts candidate frames with FFmpeg
5. rejects low-information frames
6. hashes candidates with perceptual image hashing
7. avoids near-duplicates using Hamming distance
8. keeps accepted frames and cleans up rejected candidates by default
9. adds fallback coverage frames when a video is visually repetitive

The product contract is:

> Give me up to N representative frames, spread across the full video, avoiding near-duplicates.

This works well for both mostly static videos and fast-moving clips. For a mostly still video, fallback coverage helps return useful frames across the timeline. For a fast-moving video, you can lower `minGapMs` and `similarityThreshold` to collect frames closer together while still avoiding exact duplicates.

## CLI Usage

```bash
video-sampler [videoPath] [options]
```

You can also provide the video path with `--video`:

```bash
video-sampler --video ./video.webm
```

If no video path is provided, the CLI tries to use the only supported video file in the current directory.

### CLI Options

| Option                       | Description                                                                                   | Default                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `--video <path>`             | Video file to process.                                                                        | Uses positional path or the only supported video in the current directory |
| `--frames <n>`               | Target number of frames to return. Same as `--target-frames`.                                 | `12`                                                                      |
| `--target-frames <n>`        | Target number of frames to return.                                                            | `12`                                                                      |
| `--max-frames <n>`           | Hard upper limit for returned frames.                                                         | `24`                                                                      |
| `--min-frames <n>`           | Minimum frames to try to return when feasible.                                                | `3`                                                                       |
| `--min-gap <ms>`             | Soft minimum gap between selected frames, in milliseconds.                                    | `1000`                                                                    |
| `--min-gap-ms <ms>`          | Same as `--min-gap`.                                                                          | `1000`                                                                    |
| `--start-time-ms <ms>`       | Start sampling at this timestamp, in milliseconds.                                            | `0`                                                                       |
| `--end-before-ms <ms>`       | Stop sampling this many milliseconds before the video ends.                                   | `0`                                                                       |
| `--candidate-multiplier <n>` | Candidate count multiplier. More candidates can improve variety but increase processing time. | `4`                                                                       |
| `--max-candidates <n>`       | Maximum candidate frames to inspect.                                                          | `160`                                                                     |
| `--similarity-threshold <n>` | Perceptual hash Hamming distance threshold for duplicate rejection.                           | `10`                                                                      |
| `--compare-recent <n>`       | Number of recent accepted frames to compare after early selection.                            | `5`                                                                       |
| `--frames-dir <path>`        | Output folder for accepted frames.                                                            | `./frames`                                                                |
| `--audio-dir <path>`         | Output folder for WAV audio.                                                                  | `./audio`                                                                 |
| `--format <jpg\|png\|webp>`  | Frame image format.                                                                           | `jpg`                                                                     |
| `--jpeg-quality <n>`         | FFmpeg `q:v` value for JPG output. Lower is better quality.                                   | `2`                                                                       |
| `--ffmpeg-path <path>`       | Custom FFmpeg binary path.                                                                    | Bundled FFmpeg                                                            |
| `--ffprobe-path <path>`      | Custom FFprobe binary path.                                                                   | Bundled FFprobe                                                           |
| `--debug`                    | Print FFmpeg debug output from frame extraction.                                              | `false`                                                                   |
| `--no-fallback`              | Disable fallback frame coverage.                                                              | Fallback enabled                                                          |
| `--keep-rejected`            | Keep rejected candidate frame files for inspection.                                           | Rejected candidates deleted                                               |
| `--help`, `-h`               | Print CLI help.                                                                               | -                                                                         |

### CLI Examples

Extract audio and about 20 representative frames:

```bash
npx video-sampler ./video.mp4 --frames 20
```

Use custom output folders:

```bash
npx video-sampler ./video.webm --audio-dir ./processed/audio --frames-dir ./processed/frames
```

Be more strict about duplicate frames:

```bash
npx video-sampler ./video.mp4 --frames 20 --similarity-threshold 16
```

Skip the intro:

```bash
npx video-sampler ./video.mp4 --frames 12 --start-time-ms 5000
```

Skip ending fade-outs or closing screens:

```bash
npx video-sampler ./video.mp4 --frames 12 --end-before-ms 500
```

Keep all rejected candidate images for debugging:

```bash
npx video-sampler ./video.mp4 --keep-rejected --debug
```

Use custom FFmpeg and FFprobe binaries:

```bash
npx video-sampler ./video.mp4 --ffmpeg-path /usr/local/bin/ffmpeg --ffprobe-path /usr/local/bin/ffprobe
```

## Library API

```js
import { extractAudio, sampleFrames } from 'video-sampler';
```

The package includes TypeScript declarations, so editors can show option names, defaults, and descriptions on hover.

## `extractAudio(videoPath, options)`

Extracts WAV audio from a video.

```js
const audio = await extractAudio('./video.mp4', {
  outputDir: './audio',
});
```

### Audio Options

| Option       | Type     | Description                                                                                                              | Default                                  |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `outputDir`  | `string` | Directory where the WAV file should be written. Created automatically if missing. Ignored when `outputPath` is provided. | `process.cwd()`                          |
| `outputPath` | `string` | Exact output path for the WAV file. Parent directories are created automatically.                                        | `<outputDir>/<input-video-basename>.wav` |
| `ffmpegPath` | `string` | Custom FFmpeg binary path.                                                                                               | Bundled FFmpeg                           |

### Audio Result

```js
{
  path: '/absolute/path/to/video.wav',
  mime: 'audio/wav',
  ext: 'wav'
}
```

### `outputDir` vs `outputPath`

Use `outputDir` when you want the package to name the WAV file for you:

```js
await extractAudio('./videos/video.mp4', {
  outputDir: './audio',
});
```

This writes:

```text
./audio/video.wav
```

Use `outputPath` when you want full control over the final file path:

```js
await extractAudio('./videos/video.mp4', {
  outputPath: './audio/session-123.wav',
});
```

## `sampleFrames(videoPath, options)`

Extracts representative frames from a video.

```js
const result = await sampleFrames('./video.mp4', {
  outputDir: './frames',
  targetFrames: 12,
});
```

Accepted frame files are left on disk for downstream processing. Rejected candidate files are deleted by default.
Accepted frame filenames are ordered by selection order and timestamp, for example `frame-001-t001158ms.jpg`.
When `cleanupRejected` is `false`, rejected candidate filenames include their candidate order and timestamp, for example `candidate-048-t238350ms.jpg`.

### Frame Options

| Option                  | Type                                 | Description                                                                                                                                                                          | Default         |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `targetFrames`          | `number`                             | Ideal number of frames to return. This is a target, not a guarantee. The sampler may return fewer frames when the video is short, visually repetitive, or has too few usable frames. | `12`            |
| `maxFrames`             | `number`                             | Hard upper limit for returned frames. The function never returns more than this.                                                                                                     | `24`            |
| `minFrames`             | `number`                             | Minimum frames to try to return when feasible. This may still be missed if too few usable frames can be extracted.                                                                   | `3`             |
| `minGapMs`              | `number`                             | Soft minimum spacing between selected frames, in milliseconds. The sampler may relax this during fallback selection to satisfy `minFrames`.                                          | `1000`          |
| `startTimeMs`           | `number`                             | Start sampling at this timestamp, in milliseconds. Negative values are clamped to `0` with a warning.                                                                                | `0`             |
| `endBeforeMs`           | `number`                             | Stop sampling this many milliseconds before the video ends. Useful for avoiding fade-outs, closing screens, or black ending frames.                                                  | `0`             |
| `candidateMultiplier`   | `number`                             | Multiplier used to decide how many candidate frames to inspect. With a resolved target of 12 and multiplier 4, the sampler tries about 48 candidates before filtering.               | `4`             |
| `maxCandidates`         | `number`                             | Maximum candidate frames to inspect. Prevents excessive FFmpeg and hashing work on long videos.                                                                                      | `160`           |
| `similarityThreshold`   | `number`                             | Perceptual hash Hamming distance required for a frame to count as visually distinct. Higher values reject duplicates more strictly.                                                  | `10`            |
| `compareRecentCount`    | `number`                             | Number of recent accepted frames to compare once the accepted set is large. Early selection compares against all accepted frames.                                                    | `5`             |
| `outputDir`             | `string`                             | Directory where accepted frame files should be written. Created automatically if missing.                                                                                            | `process.cwd()` |
| `imageFormat`           | `'jpg' \| 'jpeg' \| 'png' \| 'webp'` | Image format for extracted frames. `jpeg` is normalized to `jpg`.                                                                                                                    | `'jpg'`         |
| `jpegQuality`           | `number`                             | FFmpeg `q:v` value for JPEG output. Lower values produce better quality and larger files. Only applies to JPG output.                                                                | `2`             |
| `cleanupRejected`       | `boolean`                            | Delete rejected candidate frame files after selection. Set to `false` to inspect all candidates while debugging.                                                                     | `true`          |
| `includeFallbackFrames` | `boolean`                            | Add fallback frames for coverage when duplicate filtering returns too few frames. Useful for mostly still videos.                                                                    | `true`          |
| `debug`                 | `boolean`                            | Print FFmpeg extraction output.                                                                                                                                                      | `false`         |
| `ffmpegPath`            | `string`                             | Custom FFmpeg binary path.                                                                                                                                                           | Bundled FFmpeg  |
| `ffprobePath`           | `string`                             | Custom FFprobe binary path.                                                                                                                                                          | Bundled FFprobe |

### Understanding Key Frame Options

#### `targetFrames`

This is the number of frames you would like to get, not a strict promise.

For example, if you request 20 frames from a very short or visually repetitive video, the sampler may return fewer frames because it avoids near-duplicates and low-information images. If you want denser frame sampling from a fast-moving clip, lower `minGapMs` and use a lower `similarityThreshold`.

#### `candidateMultiplier`

The sampler extracts more candidate frames than it plans to return.

For example:

```js
await sampleFrames('./video.mp4', {
  targetFrames: 12,
  candidateMultiplier: 4,
});
```

This asks the sampler to inspect about 48 candidate timestamps before selecting the best representative frames.

Higher values can improve visual variety, but they also increase FFmpeg extraction and image hashing work.

#### `startTimeMs` and `endBeforeMs`

By default, the sampler considers the full usable video timeline. Use these options when you only want frames from part of a video:

```js
const result = await sampleFrames('./video.mp4', {
  startTimeMs: 30_000,
  endBeforeMs: 500,
});
```

`startTimeMs` skips the beginning of the video. `endBeforeMs` skips the end of the video, which is useful when recordings finish on fade-outs, app-closing screens, or black frames.

#### `similarityThreshold`

Each candidate frame is converted into a perceptual image hash. The sampler compares hashes using Hamming distance.

`similarityThreshold` is the minimum number of differing hash bits required for a candidate to count as visually distinct.

- lower values are more permissive and may allow similar frames
- higher values are stricter and may return fewer frames
- the default `10` is a practical starting point for general representative frame sampling

#### `cleanupRejected`

This is `true` by default.

When enabled, only accepted frame files remain in the output directory. Rejected candidate images are deleted.

Set it to `false` when debugging:

```js
await sampleFrames('./video.mp4', {
  outputDir: './frames-debug',
  cleanupRejected: false,
});
```

## Frame Result

`sampleFrames()` returns metadata, resolved options, selected frames, stats, and warnings.

```js
{
  video: {
    path: './video.mp4',
    durationSeconds: 180.42,
    width: 1920,
    height: 1080,
    fps: 30
  },
  output: {
    directory: '/absolute/path/to/frames'
  },
  options: {
    resolvedTargetFrames: 12,
    maxFrames: 24,
    minFrames: 3,
    minGapMs: 1000,
    startTimeMs: 0,
    endBeforeMs: 0,
    candidateCount: 48,
    similarityThreshold: 10
  },
  frames: [
    {
      path: '/absolute/path/to/frames/frame-id.jpg',
      timestamp: 14.29,
      hash: '...',
      score: {
        minDistanceToRecentAccepted: null,
        acceptedReason: 'first_frame'
      }
    }
  ],
  stats: {
    candidatesExtracted: 48,
    candidatesRejectedAsSimilar: 20,
    candidatesRejectedForSpacing: 4,
    candidatesRejectedAsLowInformation: 1,
    fallbackFramesAdded: 0,
    returnedFrames: 12
  },
  warnings: []
}
```

`minDistanceToRecentAccepted` is `null` for the first accepted frame because there are no earlier accepted frames to compare
against.

### Accepted Frame Reasons

| Reason                   | Meaning                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `first_frame`            | The first usable candidate frame was accepted.                                             |
| `visually_distinct`      | The frame was far enough from recently accepted frames by perceptual hash distance.        |
| `fallback_even_coverage` | The frame was added to preserve basic coverage when the video was too visually repetitive. |

## Common Recipes

### Process a video upload

```js
import { extractAudio, sampleFrames } from 'video-sampler';

const videoPath = './uploads/video.webm';

const [audio, frames] = await Promise.all([
  extractAudio(videoPath, {
    outputDir: './processed/audio',
  }),
  sampleFrames(videoPath, {
    outputDir: './processed/frames',
    targetFrames: 12,
    maxFrames: 24,
    minGapMs: 1000,
  }),
]);

console.log({
  audio: audio.path,
  frames: frames.frames.map((frame) => frame.path),
});
```

### Prefer more visual variety

```js
const result = await sampleFrames('./lecture.mp4', {
  targetFrames: 20,
  candidateMultiplier: 6,
  similarityThreshold: 14,
});
```

### Sample a fast-moving video more densely

```js
const result = await sampleFrames('./short-clip.mp4', {
  targetFrames: 20,
  minGapMs: 150,
  similarityThreshold: 5,
});
```

### Use custom binaries

```js
const result = await sampleFrames('./video.mp4', {
  ffmpegPath: '/opt/ffmpeg/bin/ffmpeg',
  ffprobePath: '/opt/ffmpeg/bin/ffprobe',
});
```

```js
const audio = await extractAudio('./video.mp4', {
  ffmpegPath: '/opt/ffmpeg/bin/ffmpeg',
});
```

## Error Handling

Both functions throw errors for fatal failures.

Examples include:

- input video file does not exist
- video duration cannot be probed
- FFmpeg cannot extract usable frames
- perceptual hash generation fails completely
- audio conversion fails

`sampleFrames()` may also return non-fatal `warnings`, such as deprecated option usage or fallback extraction behavior.

```js
try {
  const result = await sampleFrames('./video.mp4');

  for (const warning of result.warnings) {
    console.warn(warning);
  }
} catch (error) {
  console.error('Video processing failed:', error.message);
}
```

## Notes

- Frame sampling is adaptive. Requested frame counts are targets, not guarantees.
- By default, frame candidates are spread across the full usable video duration.
- Accepted frame files stay on disk for downstream processing.
- Rejected candidate files are deleted by default.
- The package does not perform facial recognition, emotion detection, pose detection, transcription, or scoring.
- Processing happens locally with FFmpeg, FFprobe, Sharp, and perceptual hashing.

## License

MIT (c) Vedang Danej
