/**
 * Pan and zoom ("Ken Burns") targets for a slide.
 *
 * - With faces, zoom toward them and pan to centre them, as far as the
 *   photo's edges allow.
 * - Without faces, zoom a random amount and pan 50-90% of the way to the
 *   edges in a random direction. The original kept this pan small (often
 *   near zero), which looked like zooming straight into the center.
 *
 * The animation runs at a constant speed (linear). The original's
 * ease-in-out barely moved at first, then sped up.
 */

export interface Pan {
  scale: number;
  /** translateX, applied after scale(), so in unscaled px */
  x: number;
  /** translateY, applied after scale(), so in unscaled px */
  y: number;
}

/** Random zoom range */
export const MIN_SCALE = 1.15;
export const MAX_SCALE = 1.35;
/** Most zoom toward faces */
export const MAX_FACE_SCALE = 1.4;
/** Animation easing: constant speed */
export const PAN_EASING = 'linear';
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

/** Faces' bounding box, relative to the photo centre, in displayed px */
export interface FaceTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Move toward -offset (to centre it), no further than limit */
const toward = (offset: number, limit: number): number => Math.max(-limit, Math.min(limit, -offset)) || 0;

/** Zoom toward faces and pan to centre them, without showing past the photo's edges */
export function facePan(target: FaceTarget, width: number, height: number): Pan {
  const scale = Math.max(1, Math.min(MAX_FACE_SCALE, width / target.width, height / target.height));
  return {
    scale,
    x: toward(target.x, maxPan(scale, width)),
    y: toward(target.y, maxPan(scale, height)),
  };
}
