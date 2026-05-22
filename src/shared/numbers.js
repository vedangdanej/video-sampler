export const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
};

export const positiveIntegerOrDefault = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

export const toPositiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

export const finiteNumberOrDefault = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const average = (values) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const roundTimestamp = (timestamp) => Number(timestamp.toFixed(3));

export const formatTimestamp = (timestamp) => Math.max(0, timestamp).toFixed(3);

export const parseFps = (frameRate) => {
  if (!frameRate || typeof frameRate !== 'string') return null;

  const [numerator, denominator] = frameRate.split('/').map(Number);
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
    return numerator / denominator;
  }

  const fps = Number(frameRate);
  return Number.isFinite(fps) && fps > 0 ? fps : null;
};
