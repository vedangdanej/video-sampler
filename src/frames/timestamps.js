import { roundTimestamp } from '../shared/numbers.js';

const EOF_MARGIN_MS = 50;
const VERY_SHORT_WINDOW_MS = 100;

export const generateCandidateTimestamps = (window, candidateCount) => {
  const count = Math.max(1, Math.floor(candidateCount));
  const startMs = Math.max(0, Math.round(window.startTimeMs));
  const endMs = Math.max(startMs, Math.round(window.endTimeMs));
  const windowDurationMs = endMs - startMs;

  if (windowDurationMs <= VERY_SHORT_WINDOW_MS || count <= 1) {
    return [roundTimestamp((startMs + windowDurationMs / 2) / 1000)];
  }

  const usableEndMs = Math.max(
    startMs,
    window.trimEndForEof ? endMs - EOF_MARGIN_MS : endMs,
  );

  if (usableEndMs <= startMs) {
    return [roundTimestamp((startMs + windowDurationMs / 2) / 1000)];
  }

  const interval = (usableEndMs - startMs) / (count - 1);
  const timestamps = [];

  for (let index = 0; index < count; index += 1) {
    timestamps.push(roundTimestamp((startMs + interval * index) / 1000));
  }

  return timestamps;
};
