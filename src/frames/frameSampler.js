import {
  fs,
  getAvailableFilePath,
  path,
  resolveOutputDirectory,
} from '../shared/files.js';
import { cleanupErroredFrames, cleanupRejectedCandidates } from './cleanup.js';
import { extractCandidateFrames } from './extraction.js';
import { rejectLowInformationFrames } from './lowInformation.js';
import {
  resolveOptions,
  resolveSamplingCounts,
  resolveSamplingWindow,
} from './options.js';
import { probeVideo } from './probe.js';
import {
  addFallbackFrames,
  selectRepresentativeFrames,
  toPublicFrame,
} from './selection.js';
import { generateCandidateTimestamps } from './timestamps.js';

export const sampleFrames = async (videoPath, options = {}) => {
  const warnings = [];
  const resolved = resolveOptions(options, warnings);
  const createdFramePaths = new Set();
  const acceptedFramePaths = new Set();

  try {
    const video = await probeVideo(videoPath, { ffprobePath: resolved.ffprobePath });
    const window = resolveSamplingWindow(video.durationSeconds, resolved, warnings);
    const sampling = resolveSamplingCounts(window.durationSeconds, resolved);
    const timestamps = generateCandidateTimestamps(window, sampling.candidateCount);
    const outputDirectory = await resolveOutputDirectory(resolved.outputDir || process.cwd());
    const candidates = await extractCandidateFrames({
      videoPath,
      timestamps,
      outputDirectory,
      imageFormat: resolved.imageFormat,
      jpegQuality: resolved.jpegQuality,
      debug: resolved.debug,
      warnings,
      createdFramePaths,
      ffmpegPath: resolved.ffmpegPath,
      videoDurationMs: window.videoDurationMs,
    });

    if (candidates.length === 0) {
      throw new Error(`FFmpeg frame extraction failed completely for video: ${videoPath}`);
    }

    const lowInformation = await rejectLowInformationFrames(candidates, warnings);
    const selection = await selectRepresentativeFrames(
      lowInformation.usableCandidates,
      sampling,
      resolved,
      warnings,
    );

    ensureSelectionSucceeded(selection, videoPath);

    const fallback = await addFallbackIfNeeded({
      accepted: selection.accepted,
      candidates: lowInformation.usableCandidates,
      sampling,
      resolved,
      warnings,
    });
    const accepted = fallback.accepted.sort((a, b) => a.timestamp - b.timestamp);
    await renameAcceptedFrames(accepted, outputDirectory, resolved.imageFormat);

    for (const frame of accepted) acceptedFramePaths.add(frame.path);
    await cleanupRejectedCandidates(candidates, acceptedFramePaths, resolved.cleanupRejected);

    return buildSamplerResult({
      videoPath,
      video,
      outputDirectory,
      sampling,
      window,
      resolved,
      timestamps,
      accepted,
      selection,
      lowInformation,
      fallbackFramesAdded: fallback.added,
      warnings,
    });
  } catch (error) {
    await cleanupErroredFrames(createdFramePaths, acceptedFramePaths);
    throw error;
  }
};

const ensureSelectionSucceeded = (selection, videoPath) => {
  if (selection.hashesAttempted > 0 && selection.hashesSucceeded === 0) {
    throw new Error(`Image hash generation failed completely for extracted frames from: ${videoPath}`);
  }

  if (selection.accepted.length === 0) {
    throw new Error(`No usable representative frames could be selected from video: ${videoPath}`);
  }
};

const addFallbackIfNeeded = async ({ accepted, candidates, sampling, resolved, warnings }) => {
  if (!resolved.includeFallbackFrames || accepted.length >= sampling.resolvedMinFrames) {
    return { accepted, added: 0 };
  }

  return addFallbackFrames({
    accepted,
    candidates,
    sampling,
    resolved,
    warnings,
  });
};

const buildSamplerResult = ({
  videoPath,
  video,
  outputDirectory,
  sampling,
  window,
  resolved,
  timestamps,
  accepted,
  selection,
  lowInformation,
  fallbackFramesAdded,
  warnings,
}) => ({
  video: {
    path: videoPath,
    durationSeconds: video.durationSeconds,
    width: video.width,
    height: video.height,
    fps: video.fps,
  },
  output: {
    directory: outputDirectory,
  },
  options: {
    resolvedTargetFrames: sampling.resolvedTargetFrames,
    maxFrames: resolved.maxFrames,
    minFrames: sampling.resolvedMinFrames,
    minGapMs: resolved.minGapMs,
    startTimeMs: Math.round(window.startTimeMs),
    endBeforeMs: Math.round(window.endBeforeMs),
    candidateCount: timestamps.length,
    similarityThreshold: resolved.similarityThreshold,
  },
  frames: accepted.map(toPublicFrame),
  stats: {
    candidatesExtracted: lowInformation.usableCandidates.length + lowInformation.rejectedLowInformation,
    candidatesRejectedAsSimilar: selection.candidatesRejectedAsSimilar,
    candidatesRejectedForSpacing: selection.candidatesRejectedForSpacing,
    candidatesRejectedAsLowInformation: lowInformation.rejectedLowInformation,
    fallbackFramesAdded,
    returnedFrames: accepted.length,
  },
  warnings,
});

const renameAcceptedFrames = async (frames, outputDirectory, imageFormat) => {
  const frameDigits = Math.max(3, String(frames.length).length);
  const timestampDigits = Math.max(
    6,
    ...frames.map((frame) => String(toTimestampMs(frame.timestamp)).length),
  );

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const frameNumber = String(index + 1).padStart(frameDigits, '0');
    const timestampMs = String(toTimestampMs(frame.timestamp)).padStart(timestampDigits, '0');
    const destination = await getAvailableFilePath(
      outputDirectory,
      `frame-${frameNumber}-t${timestampMs}ms.${imageFormat}`,
    );

    if (path.resolve(frame.path) === destination) continue;

    await fs.promises.rename(frame.path, destination);
    frame.path = destination;
  }
};

const toTimestampMs = (timestampSeconds) => Math.max(0, Math.round(timestampSeconds * 1000));

export const sampleRepresentativeFrames = sampleFrames;
