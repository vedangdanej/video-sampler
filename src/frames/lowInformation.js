import { createRequire } from 'module';
import { average } from '../shared/numbers.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

sharp.cache(false);

export const rejectLowInformationFrames = async (candidates, warnings) => {
  const usableCandidates = [];
  let rejectedLowInformation = 0;

  for (const candidate of candidates) {
    try {
      const lowInfo = await getLowInformationReason(candidate.path);

      if (lowInfo) {
        candidate.lowInformationReason = lowInfo;
        rejectedLowInformation += 1;
      } else {
        usableCandidates.push(candidate);
      }
    } catch (error) {
      candidate.lowInformationReason = 'stats_failed';
      rejectedLowInformation += 1;
      warnings.push(`Could not inspect candidate frame ${candidate.path}: ${error.message}`);
    }
  }

  if (rejectedLowInformation > 0 && rejectedLowInformation >= Math.ceil(candidates.length / 2)) {
    warnings.push(`${rejectedLowInformation} candidate frames were rejected as low-information.`);
  }

  if (usableCandidates.length === 0) {
    throw new Error('No usable frames could be extracted; all candidates were low-information or unreadable.');
  }

  return { usableCandidates, rejectedLowInformation };
};

const getLowInformationReason = async (imagePath) => {
  const stats = await sharp(imagePath).stats();
  const channels = stats.channels.slice(0, 3);
  const mean = average(channels.map((channel) => channel.mean));
  const stdev = average(channels.map((channel) => channel.stdev));

  if (mean <= 8 && stdev <= 12) return 'mostly_black';
  if (mean >= 247 && stdev <= 12) return 'mostly_white';
  if (stdev <= 2.5) return 'extremely_low_variance';

  return null;
};
