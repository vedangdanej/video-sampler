/**
 * Options for {@link extractAudio}.
 */
export interface ExtractAudioOptions {
  /**
   * Directory where the WAV file should be written.
   *
   * Default: `process.cwd()`
   *
   * If the directory does not exist, it is created automatically.
   * Ignored when `outputPath` is provided.
   */
  outputDir?: string;

  /**
   * Exact output path for the WAV file.
   *
   * Default: `<outputDir>/<input-video-basename>.wav`
   *
   * Parent directories are created automatically.
   */
  outputPath?: string;

  /**
   * Custom FFmpeg binary path.
   *
   * Default: bundled `@ffmpeg-installer/ffmpeg` binary.
   */
  ffmpegPath?: string;
}

/**
 * Result returned by {@link extractAudio}.
 */
export interface ExtractAudioResult {
  /**
   * Absolute path to the generated WAV file.
   */
  path: string;

  /**
   * MIME type for the generated audio.
   */
  mime: 'audio/wav';

  /**
   * File extension for the generated audio.
   */
  ext: 'wav';
}

/**
 * Options for {@link sampleFrames}.
 */
export interface SampleFramesOptions {
  /**
   * Ideal number of frames to return.
   *
   * Default: `12`
   *
   * This is a target, not a guarantee. The sampler may return fewer frames
   * when the video is short, visually repetitive, has broken timestamps, or
   * FFmpeg cannot extract enough usable candidates.
   */
  targetFrames?: number;

  /**
   * Hard upper limit for returned frames.
   *
   * Default: `24`
   */
  maxFrames?: number;

  /**
   * Minimum number of frames to try to return when feasible.
   *
   * Default: `3`
   *
   * This can still be missed if too few usable frames can be extracted.
   */
  minFrames?: number;

  /**
   * Soft minimum spacing between selected frames, in milliseconds.
   *
   * Default: `1000`
   *
   * The sampler respects this during primary selection and may relax it during
   * fallback selection to satisfy `minFrames`.
   */
  minGapMs?: number;

  /**
   * Start sampling at this timestamp, in milliseconds.
   *
   * Default: `0`
   *
   * Negative values are clamped to `0` with a warning.
   */
  startTimeMs?: number;

  /**
   * Stop sampling this many milliseconds before the video ends.
   *
   * Default: `0`
   *
   * Example: `endBeforeMs: 500` keeps candidates at least 500ms before EOF.
   * Negative values are clamped to `0` with a warning. If the value leaves no
   * sampling window after `startTimeMs`, the sampler falls back to the full
   * video and returns a warning.
   */
  endBeforeMs?: number;

  /**
   * Multiplier used to decide how many candidate frames to inspect.
   *
   * Default: `4`
   *
   * Example: with a resolved target of 12, the sampler tries to inspect about
   * 48 candidate frames before filtering them. Higher values can improve visual
   * variety but increase processing time.
   */
  candidateMultiplier?: number;

  /**
   * Maximum candidate frames to inspect.
   *
   * Default: `160`
   *
   * Prevents excessive FFmpeg and image hashing work on long videos.
   */
  maxCandidates?: number;

  /**
   * Perceptual hash Hamming distance required for a frame to count as visually distinct.
   *
   * Default: `10`
   *
   * This is not a percentage. Each frame is converted into a 64-bit perceptual
   * image hash, and this value is the minimum number of differing bits required
   * for a candidate frame to be accepted. With the default `10`, a frame must
   * differ by at least 10 of 64 hash bits from recently accepted frames.
   *
   * Higher values reject near-duplicates more strictly and may return fewer
   * frames. Lower values are more permissive and may return more similar frames.
   */
  similarityThreshold?: number;

  /**
   * Number of recent accepted frames to compare once the accepted set is large.
   *
   * Default: `5`
   *
   * The sampler compares against all accepted frames while the accepted set is
   * small, then only this many recent frames for efficiency.
   */
  compareRecentCount?: number;

  /**
   * Directory where accepted frame files should be written.
   *
   * Default: `process.cwd()`
   *
   * If the directory does not exist, it is created automatically.
   */
  outputDir?: string;

  /**
   * Image format for extracted frames.
   *
   * Default: `'jpg'`
   */
  imageFormat?: 'jpg' | 'jpeg' | 'png' | 'webp';

  /**
   * FFmpeg `q:v` value for JPEG output.
   *
   * Default: `2`
   *
   * Lower values produce better quality and larger files. Only applies when
   * `imageFormat` is `'jpg'` or `'jpeg'`.
   */
  jpegQuality?: number;

  /**
   * Delete rejected candidate frame files after selection.
   *
   * Default: `true`
   *
   * Set to `false` when debugging to inspect every candidate image the sampler
   * considered.
   */
  cleanupRejected?: boolean;

  /**
   * Add fallback frames for basic coverage when duplicate filtering is too strict.
   *
   * Default: `true`
   *
   * Useful for interview videos where the subject may remain visually still.
   */
  includeFallbackFrames?: boolean;

  /**
   * Print FFmpeg extraction output.
   *
   * Default: `false`
   */
  debug?: boolean;

  /**
   * Custom FFmpeg binary path.
   *
   * Default: bundled `@ffmpeg-installer/ffmpeg` binary.
   */
  ffmpegPath?: string;

  /**
   * Custom FFprobe binary path.
   *
   * Default: bundled `@ffprobe-installer/ffprobe` binary.
   */
  ffprobePath?: string;
}

/**
 * Video metadata returned by {@link sampleFrames}.
 */
export interface SampleFramesVideoMetadata {
  /**
   * Input video path passed to `sampleFrames`.
   */
  path: string;

  /**
   * Probed video duration in seconds.
   */
  durationSeconds: number;

  /**
   * Probed video width in pixels, or `null` when unavailable.
   */
  width: number | null;

  /**
   * Probed video height in pixels, or `null` when unavailable.
   */
  height: number | null;

  /**
   * Probed frames per second, or `null` when unavailable.
   */
  fps: number | null;
}

/**
 * Resolved sampling options returned by {@link sampleFrames}.
 */
export interface ResolvedSampleFramesOptions {
  /**
   * Final target frame count after applying duration and max-frame limits.
   */
  resolvedTargetFrames: number;

  /**
   * Hard upper limit used for returned frames.
   */
  maxFrames: number;

  /**
   * Minimum frame count the sampler tried to satisfy.
   */
  minFrames: number;

  /**
   * Soft spacing used between selected frames, in milliseconds.
   */
  minGapMs: number;

  /**
   * Resolved sampling-window start timestamp, in milliseconds.
   */
  startTimeMs: number;

  /**
   * Resolved number of milliseconds skipped before the video end.
   */
  endBeforeMs: number;

  /**
   * Number of candidate timestamps generated.
   */
  candidateCount: number;

  /**
   * Perceptual hash Hamming distance threshold used for duplicate filtering.
   */
  similarityThreshold: number;
}

/**
 * Reason a sampled frame was accepted.
 */
export type AcceptedFrameReason =
  | 'first_frame'
  | 'visually_distinct'
  | 'fallback_even_coverage';

/**
 * A selected representative frame.
 */
export interface SampledFrame {
  /**
   * Absolute path to the accepted frame image.
   *
   * Accepted frame files are named in timeline order, for example
   * `frame-001-t001158ms.jpg`.
   *
   * When rejected candidates are kept for debugging, their filenames include
   * candidate order and timestamp, for example `candidate-048-t238350ms.jpg`.
   */
  path: string;

  /**
   * Timestamp, in seconds, associated with this frame.
   */
  timestamp: number;

  /**
   * Perceptual image hash used for duplicate filtering.
   */
  hash: string;

  /**
   * Selection metadata for this frame.
   */
  score: {
    /**
     * Minimum Hamming distance to the compared accepted frames.
     *
     * `null` for the first accepted frame.
     */
    minDistanceToRecentAccepted: number | null;

    /**
     * Why the frame was accepted.
     */
    acceptedReason: AcceptedFrameReason;
  };
}

/**
 * Sampling stats returned by {@link sampleFrames}.
 */
export interface SampleFramesStats {
  /**
   * Number of candidate frames successfully extracted.
   */
  candidatesExtracted: number;

  /**
   * Number of candidates rejected as visually too similar.
   */
  candidatesRejectedAsSimilar: number;

  /**
   * Number of candidates rejected because they violated spacing.
   */
  candidatesRejectedForSpacing: number;

  /**
   * Number of candidates rejected as mostly black, mostly white, or too flat.
   */
  candidatesRejectedAsLowInformation: number;

  /**
   * Number of fallback frames added for coverage.
   */
  fallbackFramesAdded: number;

  /**
   * Number of frames returned.
   */
  returnedFrames: number;
}

/**
 * Result returned by {@link sampleFrames}.
 */
export interface SampleFramesResult {
  /**
   * Probed input video metadata.
   */
  video: SampleFramesVideoMetadata;

  /**
   * Output information.
   */
  output: {
    /**
     * Directory containing accepted frame files.
     */
    directory: string;
  };

  /**
   * Resolved sampling options used for this run.
   */
  options: ResolvedSampleFramesOptions;

  /**
   * Accepted representative frames.
   */
  frames: SampledFrame[];

  /**
   * Runtime counters for candidate extraction and filtering.
   */
  stats: SampleFramesStats;

  /**
   * Non-fatal issues encountered during sampling.
   */
  warnings: string[];
}

/**
 * Extract a WAV audio file from a video.
 *
 * The generated audio is PCM signed 16-bit little-endian, 16 kHz, mono.
 */
export function extractAudio(
  videoPath: string,
  options?: ExtractAudioOptions,
): Promise<ExtractAudioResult>;

/**
 * Extract representative visual frames from a video.
 *
 * Frames are spread across the full usable video duration by default, or within
 * the window defined by `startTimeMs` and `endBeforeMs`. Low-information frames
 * are rejected, and perceptual hashing is used to avoid near-duplicates.
 */
export function sampleFrames(
  videoPath: string,
  options?: SampleFramesOptions,
): Promise<SampleFramesResult>;
