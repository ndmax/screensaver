/**
 * Tiling for face detection.
 *
 * BlazeFace sees a downscaled copy of the image, so faces that are a small
 * part of a photo (most photos that aren't selfies) are missed. Detecting
 * on overlapping quarters as well as the whole image finds them, and the
 * duplicates from the overlaps are merged.
 */

/** A face bounding box in the image's natural pixel coordinates */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Quarter tiles are this fraction of each side, so neighbours overlap */
const TILE_FRACTION = 0.6;
/** Images smaller than this (longest side, px) are only detected whole */
const MIN_TILED_SIZE = 800;
/** Boxes overlapping more than this fraction of the smaller one are the same face */
const SAME_FACE = 0.5;

/** The regions to run the detector on: the whole image, then quarters */
export function tiles(width: number, height: number): Tile[] {
  const all: Tile[] = [{x: 0, y: 0, width, height}];
  if (Math.max(width, height) < MIN_TILED_SIZE) {
    return all;
  }
  const w = Math.round(width * TILE_FRACTION);
  const h = Math.round(height * TILE_FRACTION);
  for (const y of [0, height - h]) {
    for (const x of [0, width - w]) {
      all.push({x, y, width: w, height: h});
    }
  }
  return all;
}

const area = (b: Box): number => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);

/** Drop boxes that are the same face as a larger box */
export function mergeBoxes(boxes: readonly Box[]): Box[] {
  const kept: Box[] = [];
  for (const box of [...boxes].sort((a, b) => area(b) - area(a))) {
    const dup = kept.some((k) => {
      const inter = area({
        left: Math.max(k.left, box.left), top: Math.max(k.top, box.top),
        right: Math.min(k.right, box.right), bottom: Math.min(k.bottom, box.bottom),
      });
      return inter / Math.min(area(k), area(box)) > SAME_FACE;
    });
    if (!dup) {
      kept.push(box);
    }
  }
  return kept;
}
