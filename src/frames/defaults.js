export const DEFAULT_FRAME_OPTIONS = {
  targetFrames: 12,
  maxFrames: 24,
  minFrames: 3,
  minGapMs: 1000,
  startTimeMs: 0,
  endBeforeMs: 0,
  candidateMultiplier: 4,
  maxCandidates: 160,
  similarityThreshold: 10,
  compareRecentCount: 5,
  outputDir: null,
  imageFormat: 'jpg',
  jpegQuality: 2,
  cleanupRejected: true,
  includeFallbackFrames: true,
  debug: false,
};

export const MIN_FRAME_BYTES = 100;
