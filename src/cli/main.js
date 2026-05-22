import { parseArgs } from './args.js';
import { printSummary, printUsage } from './print.js';
import { processAudio, processFrames } from './processors.js';
import { resolveVideoPath } from './videoFiles.js';
import { fs, path } from '../shared/files.js';

export const main = async (argv = process.argv.slice(2), cwd = process.cwd()) => {
  const args = parseArgs(argv);

  if (args.help) {
    printUsage();
    return;
  }

  const videoPath = await resolveVideoPath(args.videoPath, cwd);
  const framesDir = path.resolve(cwd, args.framesDir || 'frames');
  const audioDir = path.resolve(cwd, args.audioDir || 'audio');

  await fs.promises.mkdir(framesDir, { recursive: true });
  await fs.promises.mkdir(audioDir, { recursive: true });

  console.log('Input video:', videoPath);
  console.log('Frames directory:', framesDir);
  console.log('Audio directory:', audioDir);

  const audio = await processAudio(videoPath, audioDir, {
    ffmpegPath: args.ffmpegPath,
  });
  const frameResult = await processFrames(videoPath, framesDir, args.frameOptions);
  const result = buildResult(frameResult, audio, audioDir);

  printSummary(result);
};

const buildResult = (frameResult, audio, audioDir) => ({
  video: frameResult.video,
  audio,
  frames: frameResult.frames,
  output: {
    audioDirectory: audioDir,
    framesDirectory: frameResult.output.directory,
  },
  options: frameResult.options,
  stats: frameResult.stats,
  warnings: frameResult.warnings,
});
