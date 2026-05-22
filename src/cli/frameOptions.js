import { DEFAULT_FRAME_OPTIONS } from '../frames/defaults.js';

export { DEFAULT_FRAME_OPTIONS };

export const applyFrameOption = (frameOptions, key, value) => {
  switch (key) {
    case 'target-frames':
    case 'targetFrames':
    case 'frames':
      frameOptions.targetFrames = parsePositiveIntegerOption(key, value);
      return true;
    case 'max-frames':
    case 'maxFrames':
      frameOptions.maxFrames = parsePositiveIntegerOption(key, value);
      return true;
    case 'min-frames':
    case 'minFrames':
      frameOptions.minFrames = parsePositiveIntegerOption(key, value);
      return true;
    case 'min-gap':
    case 'min-gap-ms':
    case 'min-gap-milliseconds':
    case 'minGapMs':
      frameOptions.minGapMs = parsePositiveNumberOption(key, value);
      return true;
    case 'min-gap-seconds':
    case 'minGapSeconds':
      frameOptions.minGapSeconds = parsePositiveNumberOption(key, value);
      return true;
    case 'start-time-ms':
    case 'startTimeMs':
      frameOptions.startTimeMs = parseNumberOption(key, value);
      return true;
    case 'end-before-ms':
    case 'endBeforeMs':
      frameOptions.endBeforeMs = parseNumberOption(key, value);
      return true;
    case 'candidate-multiplier':
    case 'candidateMultiplier':
      frameOptions.candidateMultiplier = parsePositiveIntegerOption(key, value);
      return true;
    case 'max-candidates':
    case 'maxCandidates':
      frameOptions.maxCandidates = parsePositiveIntegerOption(key, value);
      return true;
    case 'similarity-threshold':
    case 'similarityThreshold':
      frameOptions.similarityThreshold = parseNonNegativeIntegerOption(key, value);
      return true;
    case 'compare-recent':
    case 'compare-recent-count':
    case 'compareRecentCount':
      frameOptions.compareRecentCount = parsePositiveIntegerOption(key, value);
      return true;
    case 'format':
    case 'image-format':
    case 'imageFormat':
      frameOptions.imageFormat = value;
      return true;
    case 'jpeg-quality':
    case 'jpegQuality':
      frameOptions.jpegQuality = parsePositiveIntegerOption(key, value);
      return true;
    case 'debug':
      frameOptions.debug = parseBooleanOption(key, value);
      return true;
    case 'no-fallback':
      frameOptions.includeFallbackFrames = false;
      return true;
    case 'keep-rejected':
      frameOptions.cleanupRejected = false;
      return true;
    default:
      return false;
  }
};

export const isBooleanOption = (key) =>
  ['debug', 'no-fallback', 'keep-rejected'].includes(key);

const parsePositiveIntegerOption = (key, value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`--${key} must be a positive integer.`);
  }

  return number;
};

const parseNonNegativeIntegerOption = (key, value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`--${key} must be a non-negative integer.`);
  }

  return number;
};

const parseNumberOption = (key, value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`--${key} must be a number.`);
  }

  return number;
};

const parsePositiveNumberOption = (key, value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`--${key} must be a positive number.`);
  }

  return number;
};

const parseBooleanOption = (key, value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`--${key} must be true or false.`);
};
