export const printSummary = (result) => {
  console.log('');
  console.log('Processing complete.');
  console.log('Duration seconds:', result.video.durationSeconds);
  console.log('Audio file:', result.audio.path);
  console.log('Frames returned:', result.frames.length);
  console.log('Frame timestamps:', result.frames.map((frame) => frame.timestamp));
  console.log('Frame paths:');

  for (const frame of result.frames) {
    console.log(`- ${frame.path}`);
  }

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log('Stats:', result.stats);
};

export const printUsage = () => {
  console.log(`
Usage:
  video-sampler [videoPath] [options]
  video-sampler --video "./interview.webm" --frames 12 --max-frames 24

If videoPath or --video is omitted, the CLI uses the only supported video file in the project root.

Options:
  --video <path>                    Video file to process
  --frames <n>                      Target number of frames
  --target-frames <n>               Same as --frames
  --max-frames <n>                  Maximum returned frames
  --min-frames <n>                  Minimum frames to try to return
  --min-gap <ms>                    Soft minimum gap between selected frames, default 1000
  --min-gap-ms <ms>                 Same as --min-gap
  --start-time-ms <ms>              Start sampling at this timestamp, default 0
  --end-before-ms <ms>              Stop sampling this many ms before the video ends
  --candidate-multiplier <n>        Candidate count multiplier
  --max-candidates <n>              Maximum candidate frames to inspect
  --similarity-threshold <n>        pHash Hamming distance threshold
  --compare-recent <n>              Recent accepted frames to compare after early selection
  --frames-dir <path>               Output folder for accepted frames, default ./frames
  --audio-dir <path>                Output folder for WAV audio, default ./audio
  --ffmpeg-path <path>              Custom FFmpeg binary path
  --ffprobe-path <path>             Custom FFprobe binary path
  --format <jpg|png|webp>           Frame image format, default jpg
  --jpeg-quality <n>                FFmpeg q:v value for JPG, lower is better
  --debug                           Print FFmpeg debug output from frame extraction
  --no-fallback                     Disable fallback frame coverage
  --keep-rejected                   Keep rejected candidate frame files
`);
};
