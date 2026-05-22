import { createRequire } from 'module';
import { resolveBinaryPaths, runCommand } from '../shared/ffmpeg.js';
import {
  deleteFileQuietly,
  fs,
  getAvailableFilePath,
  path,
  uuidv4,
} from '../shared/files.js';
import { formatTimestamp } from '../shared/numbers.js';
import { MIN_FRAME_BYTES } from './defaults.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

sharp.cache(false);

export const extractCandidateFrames = async ({
  videoPath,
  timestamps,
  outputDirectory,
  imageFormat,
  jpegQuality,
  debug,
  warnings,
  createdFramePaths,
  ffmpegPath,
  videoDurationMs,
}) => {
  const candidates = [];
  const timestampWarnings = [];
  const naming = createCandidateNaming(timestamps.length, videoDurationMs);

  for (let index = 0; index < timestamps.length; index += 1) {
    const candidate = await extractCandidateFrame({
      videoPath,
      timestamp: timestamps[index],
      outputDirectory,
      imageFormat,
      jpegQuality,
      index,
      debug,
      warnings: timestampWarnings,
      createdFramePaths,
      ffmpegPath,
      naming,
    });

    if (candidate) candidates.push(candidate);
  }

  if (candidates.length > 0) {
    if (timestampWarnings.length > 0) {
      warnings.push(
        `Timestamp-based extraction skipped ${timestampWarnings.length} candidate frames that produced no image.`,
      );
    }

    return candidates;
  }

  warnings.push(
    `Timestamp-based frame extraction failed for all ${timestamps.length} candidates; retrying with sequential FPS extraction.`,
  );

  return extractSequentialCandidateFrames({
    videoPath,
    timestamps,
    outputDirectory,
    imageFormat,
    jpegQuality,
    debug,
    warnings,
    createdFramePaths,
    ffmpegPath,
    naming,
  });
};

const extractCandidateFrame = async ({
  videoPath,
  timestamp,
  outputDirectory,
  imageFormat,
  jpegQuality,
  index,
  debug,
  warnings,
  createdFramePaths,
  ffmpegPath,
  naming,
}) => {
  const outputPath = await getAvailableCandidatePath(
    outputDirectory,
    index,
    timestamp,
    imageFormat,
    naming,
  );
  createdFramePaths.add(outputPath);

  try {
    await extractFrame(
      videoPath,
      timestamp,
      outputPath,
      imageFormat,
      jpegQuality,
      true,
      debug,
      ffmpegPath,
    );
    await validateImageFile(outputPath);
    return { path: outputPath, timestamp, index };
  } catch (fastSeekError) {
    await deleteFileQuietly(outputPath);

    try {
      await extractFrame(
        videoPath,
        timestamp,
        outputPath,
        imageFormat,
        jpegQuality,
        false,
        debug,
        ffmpegPath,
      );
      await validateImageFile(outputPath);
      return { path: outputPath, timestamp, index };
    } catch (accurateSeekError) {
      await deleteFileQuietly(outputPath);
      warnings.push(
        `Could not extract candidate frame at ${timestamp.toFixed(3)}s: ${accurateSeekError.message || fastSeekError.message}`,
      );
      return null;
    }
  }
};

const extractFrame = async (
  videoPath,
  timestamp,
  outputPath,
  imageFormat,
  jpegQuality,
  fastSeek,
  debug,
  ffmpegPath,
) => {
  const qualityArgs = imageFormat === 'jpg' ? ['-q:v', String(jpegQuality)] : [];
  const outputArgs = ['-frames:v', '1', '-an', ...qualityArgs, outputPath];
  const timestampText = formatTimestamp(timestamp);
  const args = fastSeek
    ? ['-hide_banner', '-y', '-ss', timestampText, '-i', videoPath, ...outputArgs]
    : ['-hide_banner', '-y', '-i', videoPath, '-ss', timestampText, ...outputArgs];

  const binaries = resolveBinaryPaths({ ffmpegPath });
  const { stderr } = await runCommand(binaries.ffmpegPath, args);
  if (debug && stderr.trim()) console.log('[ffmpeg]', stderr.trim());
};

const extractSequentialCandidateFrames = async ({
  videoPath,
  timestamps,
  outputDirectory,
  imageFormat,
  jpegQuality,
  debug,
  warnings,
  createdFramePaths,
  ffmpegPath,
  naming,
}) => {
  const tempPattern = path.join(outputDirectory, `candidate-${uuidv4()}-%04d.${imageFormat}`);
  const fps = Math.max(1, Math.min(12, timestamps.length));
  const qualityArgs = imageFormat === 'jpg' ? ['-q:v', String(jpegQuality)] : [];
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    videoPath,
    '-map',
    '0:v:0',
    '-vf',
    `fps=${fps}`,
    '-frames:v',
    String(timestamps.length),
    ...qualityArgs,
    tempPattern,
  ];

  const binaries = resolveBinaryPaths({ ffmpegPath });
  const { stderr } = await runCommand(binaries.ffmpegPath, args);
  if (debug && stderr.trim()) console.log('[ffmpeg sequential]', stderr.trim());

  const extractedPaths = await findSequentialOutputs(tempPattern);
  const candidates = [];

  for (let index = 0; index < extractedPaths.length; index += 1) {
    const originalPath = extractedPaths[index];
    const timestamp = timestamps[Math.min(index, timestamps.length - 1)];
    const outputPath = await getAvailableCandidatePath(
      outputDirectory,
      index,
      timestamp,
      imageFormat,
      naming,
    );
    createdFramePaths.add(outputPath);

    try {
      await fs.promises.rename(originalPath, outputPath);
      await validateImageFile(outputPath);
      candidates.push({
        path: outputPath,
        timestamp,
        index,
      });
    } catch (error) {
      await deleteFileQuietly(originalPath);
      await deleteFileQuietly(outputPath);
      warnings.push(`Could not validate sequential fallback frame ${originalPath}: ${error.message}`);
    }
  }

  if (candidates.length > 0 && candidates.length < timestamps.length) {
    warnings.push(
      `Sequential FPS fallback extracted ${candidates.length} of ${timestamps.length} requested candidate frames.`,
    );
  }

  return candidates;
};

const findSequentialOutputs = async (tempPattern) => {
  const directory = path.dirname(tempPattern);
  const basename = path.basename(tempPattern);
  const [prefix, suffix] = basename.split('%04d');
  const entries = await fs.promises.readdir(directory);

  return entries
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(suffix))
    .sort()
    .map((entry) => path.join(directory, entry));
};

const createCandidateNaming = (candidateCount, videoDurationMs) => ({
  indexDigits: Math.max(3, String(Math.max(1, candidateCount)).length),
  timestampDigits: Math.max(6, String(Math.max(0, Math.round(videoDurationMs || 0))).length),
});

const getAvailableCandidatePath = async (
  outputDirectory,
  index,
  timestamp,
  imageFormat,
  naming,
) => {
  const candidateNumber = String(index + 1).padStart(naming.indexDigits, '0');
  const timestampMs = String(toTimestampMs(timestamp)).padStart(naming.timestampDigits, '0');

  return getAvailableFilePath(
    outputDirectory,
    `candidate-${candidateNumber}-t${timestampMs}ms.${imageFormat}`,
  );
};

const toTimestampMs = (timestampSeconds) => Math.max(0, Math.round(timestampSeconds * 1000));

export const validateImageFile = async (imagePath) => {
  const stat = await fs.promises.stat(imagePath);

  if (!stat.isFile() || stat.size < MIN_FRAME_BYTES) {
    throw new Error(`Extracted frame is missing or too small: ${imagePath}`);
  }

  await sharp(imagePath).metadata();
};
