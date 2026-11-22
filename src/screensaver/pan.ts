/**
 * Random pan and zoom for photos with no detected faces.
 *
 * The original kept this pan small (at most 20% of the zoom margin, often
 * near zero), which looked like zooming straight into the center. This pans
 * 50-90% of the way to the photo's edges, in a random direction, without
 * ever showing past them.
 */

export interface Pan {
  scale: number;
  /** translateX, applied after scale(), so in unscaled px */
  x: number;
  /** translateY, applied after scale(), so in unscaled px */
  y: number;
}

const MIN_SCALE = 1.2;
const MAX_SCALE = 1.6;
const MIN_FRACTION = 0.5;
const MAX_FRACTION = 0.9;

/**
 * Largest translation that keeps the edge of a photo of `size` px covered
 * at `scale`. The transform is `scale(s) translate(t)`, so the visible shift
 * is s * t, and the photo overhangs (s - 1) / 2 of its size on each side.
 */
export function maxPan(scale: number, size: number): number {
  return ((scale - 1) / (2 * scale)) * size;
}

/** Pick a random zoom and pan for a photo displayed at width x height */
export function randomPan(width: number, height: number, rnd: () => number = Math.random): Pan {
  const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * rnd();
  const axis = (size: number): number => {
    const sign = rnd() < 0.5 ? -1 : 1;
    const fraction = MIN_FRACTION + (MAX_FRACTION - MIN_FRACTION) * rnd();
    return Math.trunc(sign * fraction * maxPan(scale, size));
  };
  const x = axis(width);
  const y = axis(height);
  return {scale, x, y};
}
