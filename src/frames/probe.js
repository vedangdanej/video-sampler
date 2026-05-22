import { resolveBinaryPaths, runCommand } from '../shared/ffmpeg.js';
import { assertFileExists } from '../shared/files.js';
import {
  firstFiniteNumber,
  parseFps,
  toPositiveInteger,
} from '../shared/numbers.js';

export const probeVideo = async (videoPath, options = {}) => {
  if (!videoPath || typeof videoPath !== 'string') {
    throw new Error('Input video path is required.');
  }

  await assertFileExists(
    videoPath,
    `Input video file does not exist: ${videoPath}`,
    `Input video path is not a file: ${videoPath}`,
  );

  const binaries = resolveBinaryPaths(options);
  const { stdout, stderr } = await runCommand(binaries.ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    videoPath,
  ]);

  const metadata = parseProbeMetadata(stdout, videoPath);
  const videoStream = Array.isArray(metadata.streams)
    ? metadata.streams.find((stream) => stream.codec_type === 'video')
    : null;

  const durationSeconds = firstFiniteNumber(
    videoStream?.duration,
    metadata.format?.duration,
  );

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    const detail = stderr ? ` ffprobe stderr: ${stderr.trim()}` : '';
    throw new Error(`Video duration could not be determined for ${videoPath}.${detail}`);
  }

  return {
    durationSeconds,
    width: toPositiveInteger(videoStream?.width, null),
    height: toPositiveInteger(videoStream?.height, null),
    fps: parseFps(videoStream?.avg_frame_rate || videoStream?.r_frame_rate),
  };
};

const parseProbeMetadata = (stdout, videoPath) => {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse ffprobe metadata for ${videoPath}: ${error.message}`);
  }
};
