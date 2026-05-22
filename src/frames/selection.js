import { getImageHash, hammingDistance } from './hash.js';

export const selectRepresentativeFrames = async (candidates, sampling, options, warnings) => {
  const accepted = [];
  let candidatesRejectedAsSimilar = 0;
  let candidatesRejectedForSpacing = 0;
  let hashesAttempted = 0;
  let hashesSucceeded = 0;

  for (const candidate of candidates) {
    if (accepted.length >= sampling.resolvedTargetFrames) break;

    if (accepted.length > 0 && violatesMinGap(candidate, accepted, options.minGapSeconds)) {
      candidatesRejectedForSpacing += 1;
      continue;
    }

    hashesAttempted += 1;

    try {
      candidate.hash = await getImageHash(candidate.path);
      hashesSucceeded += 1;
    } catch (error) {
      warnings.push(`Could not hash candidate frame ${candidate.path}: ${error.message}`);
      continue;
    }

    if (accepted.length === 0) {
      accepted.push(toAcceptedFrame(candidate, null, 'first_frame'));
      continue;
    }

    const minDistance = getMinimumDistanceToAccepted(
      candidate.hash,
      accepted,
      options.compareRecentCount,
    );

    if (minDistance >= options.similarityThreshold) {
      accepted.push(toAcceptedFrame(candidate, minDistance, 'visually_distinct'));
    } else {
      candidatesRejectedAsSimilar += 1;
    }
  }

  return {
    accepted,
    candidatesRejectedAsSimilar,
    candidatesRejectedForSpacing,
    hashesAttempted,
    hashesSucceeded,
  };
};

export const addFallbackFrames = async ({ accepted, candidates, sampling, resolved, warnings }) => {
  const selected = [...accepted];
  const acceptedPaths = new Set(selected.map((frame) => frame.path));
  const targetCount = Math.min(sampling.resolvedTargetFrames, resolved.maxFrames);
  const needed = Math.min(sampling.resolvedMinFrames, targetCount);
  let added = 0;

  for (const minGapSeconds of getFallbackGapAttempts(resolved.minGapSeconds)) {
    if (selected.length >= needed || selected.length >= targetCount) break;

    const pool = candidates.filter((candidate) => !acceptedPaths.has(candidate.path));
    const ordered = orderCandidatesForEvenCoverage(pool, selected, targetCount);

    for (const candidate of ordered) {
      if (selected.length >= needed || selected.length >= targetCount) break;
      if (minGapSeconds > 0 && violatesMinGap(candidate, selected, minGapSeconds)) continue;

      const fallbackFrame = await buildFallbackFrame(candidate, selected, resolved, warnings);
      if (!fallbackFrame) continue;

      selected.push(fallbackFrame);
      acceptedPaths.add(candidate.path);
      added += 1;
    }
  }

  return { accepted: selected, added };
};

export const toPublicFrame = (frame) => ({
  path: frame.path,
  timestamp: frame.timestamp,
  hash: frame.hash,
  score: {
    minDistanceToRecentAccepted: frame.score.minDistanceToRecentAccepted,
    acceptedReason: frame.score.acceptedReason,
  },
});

export const violatesMinGap = (candidate, accepted, minGapSeconds) =>
  accepted.some((frame) => Math.abs(candidate.timestamp - frame.timestamp) < minGapSeconds);

const buildFallbackFrame = async (candidate, selected, resolved, warnings) => {
  try {
    if (!candidate.hash) candidate.hash = await getImageHash(candidate.path);
  } catch (error) {
    warnings.push(`Could not hash fallback frame ${candidate.path}: ${error.message}`);
    return null;
  }

  const minDistance = selected.length > 0
    ? getMinimumDistanceToAccepted(candidate.hash, selected, resolved.compareRecentCount)
    : null;

  return toAcceptedFrame(candidate, minDistance, 'fallback_even_coverage');
};

const toAcceptedFrame = (candidate, minDistanceToRecentAccepted, acceptedReason) => ({
  path: candidate.path,
  timestamp: candidate.timestamp,
  hash: candidate.hash,
  score: {
    minDistanceToRecentAccepted,
    acceptedReason,
  },
});

const getMinimumDistanceToAccepted = (hash, accepted, compareRecentCount) => {
  const comparisonSet = accepted.length <= compareRecentCount
    ? accepted
    : accepted.slice(-compareRecentCount);

  return Math.min(...comparisonSet.map((frame) => hammingDistance(hash, frame.hash)));
};

const getFallbackGapAttempts = (minGapSeconds) => [
  minGapSeconds,
  minGapSeconds / 2,
  minGapSeconds / 4,
  0,
];

const orderCandidatesForEvenCoverage = (candidates, accepted, targetCount) => {
  if (candidates.length <= 1) return candidates;

  const acceptedTimestamps = accepted.map((frame) => frame.timestamp);

  return [...candidates].sort((a, b) => {
    const aDistance = distanceFromNearestTimestamp(a.timestamp, acceptedTimestamps);
    const bDistance = distanceFromNearestTimestamp(b.timestamp, acceptedTimestamps);

    if (bDistance !== aDistance) return bDistance - aDistance;

    const aBucket = Math.floor((a.index / Math.max(1, candidates.length - 1)) * targetCount);
    const bBucket = Math.floor((b.index / Math.max(1, candidates.length - 1)) * targetCount);

    if (aBucket !== bBucket) return aBucket - bBucket;
    return a.timestamp - b.timestamp;
  });
};

const distanceFromNearestTimestamp = (timestamp, timestamps) => {
  if (timestamps.length === 0) return Number.POSITIVE_INFINITY;

  return Math.min(...timestamps.map((otherTimestamp) => Math.abs(timestamp - otherTimestamp)));
};
