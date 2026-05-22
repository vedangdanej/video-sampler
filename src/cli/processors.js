import { extractAudio } from '../audio/extractAudioBuffer.js';
import { sampleFrames } from '../frames/frameSampler.js';

export const processAudio = async (videoPath, audioDir, options = {}) =>
  extractAudio(videoPath, {
    outputDir: audioDir,
    ffmpegPath: options.ffmpegPath,
  });

export const processFrames = async (videoPath, framesDir, frameOptions) =>
  sampleFrames(videoPath, {
    ...frameOptions,
    outputDir: framesDir,
  });
