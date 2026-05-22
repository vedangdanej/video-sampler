import {
  COMMON_INPUT_OPTS,
  runFfmpegCLI,
  runFfmpegPipe,
  runFfmpegPipeToFile,
} from '../shared/ffmpeg.js';
import {
  createTempPath,
  deleteFilesQuietly,
  fs,
  moveFile,
  path,
} from '../shared/files.js';

const WAV_TOO_SMALL_MESSAGE = 'WAV too small - conversion failed';

export { COMMON_INPUT_OPTS, runFfmpegPipe, runFfmpegPipeToFile };

export const isMp4ByHeader = async (filePath) => {
  const fileHandle = await fs.promises.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(8);
    await fileHandle.read(buffer, 0, 8, 0);
    return buffer.slice(4, 8).toString() === 'ftyp';
  } finally {
    await fileHandle.close();
  }
};

export const extractAudio = async (videoPath, options = {}) => {
  const outputPath = await resolveAudioOutputPath(videoPath, options);
  const extracted = await extractAudioWavPath(videoPath, options);

  await moveFile(extracted.wavPath, outputPath);

  return {
    path: outputPath,
    mime: extracted.mime,
    ext: extracted.ext,
  };
};

export const extractAudioWavPath = async (videoPath, options = {}) => {
  const tmpIn = createTempPath('.in');
  await fs.promises.copyFile(videoPath, tmpIn);

  const isMp4 = await isMp4ByHeader(tmpIn);
  const tmpRemux = isMp4 ? createTempPath('.remux.mp4') : null;
  const tmpOut = createTempPath('.wav');

  try {
    const wavPath = await convertTempInputToWavPath({
      tmpIn,
      tmpOut,
      tmpRemux,
      isMp4,
      ffmpegPath: options.ffmpegPath,
    });
    return { wavPath, mime: 'audio/wav', ext: 'wav' };
  } catch (error) {
    await deleteFilesQuietly([tmpOut, tmpIn, tmpRemux]);
    throw error;
  } finally {
    await deleteFilesQuietly([tmpIn, tmpRemux]);
  }
};

const extractAudioBuffer = async (videoBuffer, options = {}) => {
  const tmpIn = createTempPath('.in');
  await fs.promises.writeFile(tmpIn, videoBuffer);

  const isMp4 = videoBuffer.slice(4, 8).toString() === 'ftyp';
  const tmpRemux = isMp4 ? createTempPath('.remux.mp4') : null;
  const tmpOut = createTempPath('.wav');

  try {
    await convertTempInputToWavPath({
      tmpIn,
      tmpOut,
      tmpRemux,
      isMp4,
      ffmpegPath: options.ffmpegPath,
    });

    const wav = await fs.promises.readFile(tmpOut);
    if (wav.length < 1024) throw new Error(WAV_TOO_SMALL_MESSAGE);

    return { buffer: wav, mime: 'audio/wav', ext: 'wav' };
  } finally {
    await deleteFilesQuietly([tmpIn, tmpRemux, tmpOut]);
  }
};

const convertTempInputToWavPath = async ({ tmpIn, tmpOut, tmpRemux, isMp4, ffmpegPath }) => {
  if (isMp4) {
    await runFfmpegCLI(
      ['-y', '-i', tmpIn, '-c', 'copy', '-movflags', '+faststart', tmpRemux],
      { ffmpegPath },
    );
  }

  const decodeInput = isMp4 ? tmpRemux : tmpIn;

  await runFfmpegCLI(
    [
      '-y',
      ...COMMON_INPUT_OPTS,
      '-i',
      decodeInput,
      '-map',
      '0:a:0',
      '-vn',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      tmpOut,
    ],
    { ffmpegPath },
  );

  const stat = await fs.promises.stat(tmpOut);
  if (stat.size < 1024) throw new Error(WAV_TOO_SMALL_MESSAGE);

  return tmpOut;
};

const resolveAudioOutputPath = async (videoPath, options) => {
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    return outputPath;
  }

  const outputDir = path.resolve(options.outputDir || process.cwd());
  await fs.promises.mkdir(outputDir, { recursive: true });

  return path.join(outputDir, `${path.parse(videoPath).name}.wav`);
};

export default extractAudioBuffer;
