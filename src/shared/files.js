import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export { fs, os, path, uuidv4 };

export const createTempPath = (extension) =>
  path.join(os.tmpdir(), `${uuidv4()}${extension}`);

export const deleteFileQuietly = async (filePath) => {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => {});
};

export const deleteFilesQuietly = async (filePaths) => {
  await Promise.all(filePaths.filter(Boolean).map(deleteFileQuietly));
};

export const moveFile = async (fromPath, toPath) => {
  await fs.promises.mkdir(path.dirname(toPath), { recursive: true });

  try {
    await fs.promises.rename(fromPath, toPath);
  } catch {
    await fs.promises.copyFile(fromPath, toPath);
    await deleteFileQuietly(fromPath);
  }
};

export const getAvailableFilePath = async (directory, fileName) => {
  const parsed = path.parse(fileName);
  let candidate = path.join(directory, fileName);
  let suffix = 2;

  while (await fileExists(candidate)) {
    candidate = path.join(directory, `${parsed.name}-${suffix}${parsed.ext}`);
    suffix += 1;
  }

  return candidate;
};

export const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const resolveOutputDirectory = async (outputDir, prefix) => {
  if (outputDir) {
    const directory = path.resolve(outputDir);
    await fs.promises.mkdir(directory, { recursive: true });
    return directory;
  }

  return fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
};

export const assertFileExists = async (filePath, missingMessage, notFileMessage) => {
  let stat;

  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    throw new Error(missingMessage);
  }

  if (!stat.isFile()) {
    throw new Error(notFileMessage);
  }

  return stat;
};
