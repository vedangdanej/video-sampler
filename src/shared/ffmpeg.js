import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

export const bundledFfmpegPath = require('@ffmpeg-installer/ffmpeg').path;
export const bundledFfprobePath = require('@ffprobe-installer/ffprobe').path;
export const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(bundledFfmpegPath);

export const COMMON_INPUT_OPTS = [
  '-analyzeduration',
  '2147483647',
  '-probesize',
  '2147483647',
  '-fflags',
  '+genpts',
];

export const resolveBinaryPaths = (options = {}) => ({
  ffmpegPath: options.ffmpegPath || bundledFfmpegPath,
  ffprobePath: options.ffprobePath || bundledFfprobePath,
});

export const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      reject(new Error(`Could not run ${command}: ${error.message}`));
    });
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${path.basename(command)} exited ${code}: ${stderr.trim()}`));
    });
  });

export const runFfmpegCLI = async (args, options = {}) => {
  const binaries = resolveBinaryPaths(options);
  await runCommand(binaries.ffmpegPath, args);
};

export const runFfmpegPipeToFile = (inputPath, outputOpts, format, outputPath, inputOpts = []) =>
  new Promise((resolve, reject) => {
    const stdin = new PassThrough();
    const inputStream = fs.createReadStream(inputPath);
    const outStream = fs.createWriteStream(outputPath);

    inputStream.on('error', reject);
    outStream.on('error', reject);
    outStream.on('finish', resolve);
    inputStream.pipe(stdin);

    ffmpeg()
      .addInput(stdin)
      .inputOptions(inputOpts)
      .outputOptions(outputOpts)
      .format(format)
      .on('start', (cmd) => console.log('[ffmpeg start]', cmd))
      .on('stderr', (line) => console.log('[ffmpeg]', line))
      .on('error', reject)
      .pipe(outStream, { end: true });
  });

export const runFfmpegPipe = (inputBuffer, outputOpts, format, inputOpts = []) =>
  new Promise((resolve, reject) => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const chunks = [];

    stdout.on('data', (chunk) => chunks.push(chunk));
    stdout.on('end', () => resolve(Buffer.concat(chunks)));
    stdout.on('error', reject);
    stdin.end(inputBuffer);

    ffmpeg()
      .addInput(stdin)
      .inputOptions(inputOpts)
      .outputOptions(outputOpts)
      .format(format)
      .on('start', (cmd) => console.log('[ffmpeg start]', cmd))
      .on('stderr', (line) => console.log('[ffmpeg]', line))
      .on('error', reject)
      .pipe(stdout, { end: true });
  });
