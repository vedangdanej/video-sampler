import {
  DEFAULT_FRAME_OPTIONS,
  applyFrameOption,
  isBooleanOption,
} from './frameOptions.js';

export const parseArgs = (argv) => {
  const args = {
    videoPath: null,
    framesDir: null,
    audioDir: null,
    ffmpegPath: null,
    ffprobePath: null,
    frameOptions: { ...DEFAULT_FRAME_OPTIONS },
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      applyPositionalArg(args, arg);
      continue;
    }

    const option = readOption(arg, argv[index + 1]);
    if (option.consumedNext) index += 1;

    applyOption(args, option.key, option.value);
  }

  return args;
};

const applyPositionalArg = (args, arg) => {
  if (!args.videoPath) {
    args.videoPath = arg;
    return;
  }

  throw new Error(`Unexpected positional argument: ${arg}`);
};

const readOption = (arg, nextArg) => {
  const equalsIndex = arg.indexOf('=');

  if (equalsIndex !== -1) {
    return {
      key: arg.slice(2, equalsIndex),
      value: arg.slice(equalsIndex + 1),
      consumedNext: false,
    };
  }

  const key = arg.slice(2);

  if (isBooleanOption(key)) {
    return { key, value: 'true', consumedNext: false };
  }

  if (!nextArg || nextArg.startsWith('--')) {
    throw new Error(`Missing value for --${key}`);
  }

  return { key, value: nextArg, consumedNext: true };
};

const applyOption = (args, key, value) => {
  switch (key) {
    case 'video':
      args.videoPath = value;
      return;
    case 'frames-dir':
    case 'framesDir':
    case 'output-dir':
    case 'outputDir':
      args.framesDir = value;
      return;
    case 'audio-dir':
    case 'audioDir':
      args.audioDir = value;
      return;
    case 'ffmpeg-path':
    case 'ffmpegPath':
      args.ffmpegPath = value;
      args.frameOptions.ffmpegPath = value;
      return;
    case 'ffprobe-path':
    case 'ffprobePath':
      args.ffprobePath = value;
      args.frameOptions.ffprobePath = value;
      return;
    default:
      if (applyFrameOption(args.frameOptions, key, value)) return;
      throw new Error(`Unknown option: --${key}`);
  }
};
