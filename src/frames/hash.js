import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const phash = require('sharp-phash');

sharp.cache(false);

export const getImageHash = async (imagePath) => {
  const hash = await phash(imagePath);

  if (typeof hash === 'string') return hash;
  if (typeof hash === 'bigint') return hash.toString(2).padStart(64, '0');

  throw new Error(`Unsupported perceptual hash return type: ${typeof hash}`);
};

export const hammingDistance = (hashA, hashB) => {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') {
    throw new Error('Cannot compare non-string perceptual hashes.');
  }

  const binaryA = normalizeHashToBinary(hashA);
  const binaryB = normalizeHashToBinary(hashB);
  const length = Math.min(binaryA.length, binaryB.length);
  let distance = Math.abs(binaryA.length - binaryB.length);

  for (let index = 0; index < length; index += 1) {
    if (binaryA[index] !== binaryB[index]) distance += 1;
  }

  return distance;
};

const normalizeHashToBinary = (hash) => {
  if (/^[01]+$/.test(hash)) return hash;

  if (/^[a-f0-9]+$/i.test(hash)) {
    return hash
      .split('')
      .map((char) => parseInt(char, 16).toString(2).padStart(4, '0'))
      .join('');
  }

  return hash;
};
