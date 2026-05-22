import { deleteFileQuietly } from '../shared/files.js';

export const cleanupRejectedCandidates = async (candidates, acceptedPaths, cleanupRejected) => {
  if (!cleanupRejected) return;

  await Promise.all(
    candidates
      .filter((candidate) => !acceptedPaths.has(candidate.path))
      .map((candidate) => deleteFileQuietly(candidate.path)),
  );
};

export const cleanupErroredFrames = async (createdFramePaths, acceptedFramePaths) => {
  await Promise.all(
    [...createdFramePaths]
      .filter((framePath) => !acceptedFramePaths.has(framePath))
      .map(deleteFileQuietly),
  );
};
