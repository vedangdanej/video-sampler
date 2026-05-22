import { fs, path } from '../shared/files.js';

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.mkv',
  '.avi',
]);

export const resolveVideoPath = async (videoPath, cwd) => {
  const resolved = videoPath
    ? path.resolve(cwd, videoPath)
    : await findSingleVideoInDirectory(cwd);

  let stat;
  try {
    stat = await fs.promises.stat(resolved);
  } catch {
    throw new Error(`Video file does not exist: ${resolved}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Video path is not a file: ${resolved}`);
  }

  return resolved;
};

const findSingleVideoInDirectory = async (directory) => {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const videos = entries
    .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directory, entry.name));

  if (videos.length === 0) {
    throw new Error('No video path was provided and no supported video file was found in this directory.');
  }

  if (videos.length > 1) {
    throw new Error(
      `Multiple video files were found. Pass one explicitly with --video. Found: ${videos.map((file) => path.basename(file)).join(', ')}`,
    );
  }

  return videos[0];
};
