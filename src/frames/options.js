import {
  finiteNumberOrDefault,
  positiveIntegerOrDefault,
} from '../shared/numbers.js';
import { DEFAULT_FRAME_OPTIONS } from './defaults.js';

export const resolveOptions = (options, warnings) => {
  const merged = { ...DEFAULT_FRAME_OPTIONS, ...options };

  const maxFrames = positiveIntegerOrDefault(merged.maxFrames, DEFAULT_FRAME_OPTIONS.maxFrames);
  const targetFrames = positiveIntegerOrDefault(merged.targetFrames, DEFAULT_FRAME_OPTIONS.targetFrames);
  const minFrames = Math.min(
    positiveIntegerOrDefault(merged.minFrames, DEFAULT_FRAME_OPTIONS.minFrames),
    maxFrames,
  );

  const minGapMs = resolveMinGapMs(merged, options, warnings);
  const minGapSeconds = minGapMs / 1000;
  const startTimeMs = resolveStartTimeMs(merged.startTimeMs, warnings);
  const endBeforeMs = resolveEndBeforeMs(merged.endBeforeMs, warnings);

  let imageFormat = String(merged.imageFormat || DEFAULT_FRAME_OPTIONS.imageFormat).toLowerCase();
  if (imageFormat === 'jpeg') imageFormat = 'jpg';

  if (!['jpg', 'png', 'webp'].includes(imageFormat)) {
    warnings.push(`Unsupported imageFormat "${merged.imageFormat}" was replaced with jpg.`);
    imageFormat = 'jpg';
  }

  return {
    targetFrames,
    maxFrames,
    minFrames,
    minGapMs,
    minGapSeconds,
    startTimeMs,
    endBeforeMs,
    candidateMultiplier: Math.max(
      1,
      positiveIntegerOrDefault(
        merged.candidateMultiplier,
        DEFAULT_FRAME_OPTIONS.candidateMultiplier,
      ),
    ),
    maxCandidates: Math.max(
      1,
      positiveIntegerOrDefault(merged.maxCandidates, DEFAULT_FRAME_OPTIONS.maxCandidates),
    ),
    similarityThreshold: Math.max(
      0,
      positiveIntegerOrDefault(
        merged.similarityThreshold,
        DEFAULT_FRAME_OPTIONS.similarityThreshold,
      ),
    ),
    compareRecentCount: Math.max(
      1,
      positiveIntegerOrDefault(
        merged.compareRecentCount,
        DEFAULT_FRAME_OPTIONS.compareRecentCount,
      ),
    ),
    outputDir: merged.outputDir,
    ffmpegPath: merged.ffmpegPath,
    ffprobePath: merged.ffprobePath,
    imageFormat,
    jpegQuality: positiveIntegerOrDefault(
      merged.jpegQuality,
      DEFAULT_FRAME_OPTIONS.jpegQuality,
    ),
    cleanupRejected: merged.cleanupRejected !== false,
    includeFallbackFrames: merged.includeFallbackFrames !== false,
    debug: Boolean(merged.debug),
  };
};

const resolveStartTimeMs = (value, warnings) => {
  let startTimeMs = finiteNumberOrDefault(value, DEFAULT_FRAME_OPTIONS.startTimeMs);

  if (value !== undefined && !Number.isFinite(Number(value))) {
    warnings.push(`Invalid startTimeMs "${value}" was replaced with 0.`);
    startTimeMs = 0;
  }

  if (startTimeMs < 0) {
    warnings.push(`Invalid startTimeMs "${value}" was replaced with 0.`);
    startTimeMs = 0;
  }

  return startTimeMs;
};

const resolveEndBeforeMs = (value, warnings) => {
  let endBeforeMs = finiteNumberOrDefault(value, DEFAULT_FRAME_OPTIONS.endBeforeMs);

  if (value !== undefined && !Number.isFinite(Number(value))) {
    warnings.push(`Invalid endBeforeMs "${value}" was replaced with 0.`);
    endBeforeMs = 0;
  }

  if (endBeforeMs < 0) {
    warnings.push(`Invalid endBeforeMs "${value}" was replaced with 0.`);
    endBeforeMs = 0;
  }

  return endBeforeMs;
};

const resolveMinGapMs = (options, rawOptions, warnings) => {
  if (rawOptions.minGapSeconds !== undefined && rawOptions.minGapMs === undefined) {
    warnings.push(
      'minGapSeconds is deprecated. Use minGapMs instead.',
    );
    return validateMinGapMs(options.minGapSeconds * 1000, options.minGapSeconds, warnings);
  }

  return validateMinGapMs(options.minGapMs, options.minGapMs, warnings);
};

const validateMinGapMs = (value, originalValue, warnings) => {
  let minGapMs = finiteNumberOrDefault(value, DEFAULT_FRAME_OPTIONS.minGapMs);

  if (minGapMs <= 0) {
    warnings.push(
      `Invalid minGapMs "${originalValue}" was replaced with ${DEFAULT_FRAME_OPTIONS.minGapMs}.`,
    );
    minGapMs = DEFAULT_FRAME_OPTIONS.minGapMs;
  }

  return minGapMs;
};

export const resolveSamplingWindow = (durationSeconds, options, warnings) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid video duration: ${durationSeconds}`);
  }

  const durationMs = durationSeconds * 1000;
  let startTimeMs = Math.min(options.startTimeMs, durationMs);
  let endBeforeMs = options.endBeforeMs;
  let endTimeMs = durationMs - endBeforeMs;
  let trimEndForEof = endBeforeMs === 0;

  if (options.startTimeMs >= durationMs) {
    warnings.push(
      `startTimeMs "${options.startTimeMs}" is beyond the video duration; using the full video instead.`,
    );
    startTimeMs = 0;
    endTimeMs = durationMs;
    endBeforeMs = 0;
    trimEndForEof = true;
  } else if (endTimeMs <= startTimeMs) {
    warnings.push(
      `endBeforeMs "${options.endBeforeMs}" leaves no sampling window after startTimeMs "${options.startTimeMs}"; using the full video instead.`,
    );
    startTimeMs = 0;
    endTimeMs = durationMs;
    endBeforeMs = 0;
    trimEndForEof = true;
  }

  return {
    startTimeMs,
    endTimeMs,
    endBeforeMs,
    trimEndForEof,
    startSeconds: startTimeMs / 1000,
    endSeconds: endTimeMs / 1000,
    durationSeconds: Math.max(0.001, (endTimeMs - startTimeMs) / 1000),
    videoDurationMs: durationMs,
  };
};

export const resolveSamplingCounts = (durationSeconds, options) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid sampling duration: ${durationSeconds}`);
  }

  const theoreticalMaxByGap = Math.max(
    1,
    Math.floor(durationSeconds / options.minGapSeconds),
  );
  const absoluteMaxByDuration = Math.max(
    1,
    Math.min(options.maxFrames, Math.floor(durationSeconds * 2)),
  );

  const primaryTargetFrames = Math.max(
    1,
    Math.min(options.targetFrames, options.maxFrames, theoreticalMaxByGap),
  );
  const minimumCoverageFrames = Math.max(
    1,
    Math.min(options.minFrames, options.maxFrames, absoluteMaxByDuration),
  );
  const resolvedTargetFrames = Math.max(
    1,
    Math.min(
      options.maxFrames,
      absoluteMaxByDuration,
      Math.max(primaryTargetFrames, minimumCoverageFrames),
    ),
  );

  const resolvedMinFrames = Math.max(
    1,
    Math.min(options.minFrames, resolvedTargetFrames),
  );

  const candidateCount = Math.min(
    options.maxCandidates,
    Math.max(resolvedTargetFrames * options.candidateMultiplier, resolvedTargetFrames),
  );

  return {
    theoreticalMaxByGap,
    resolvedTargetFrames,
    resolvedMinFrames,
    candidateCount,
  };
};
