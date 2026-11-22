import {describe, expect, it} from 'vitest';
import {type Box, mergeBoxes, tiles} from '../src/screensaver/face_tiles';

describe('tiles', () => {
  it('is the whole image, then four overlapping quarters', () => {
    const t = tiles(4000, 3000);
    expect(t[0]).toEqual({x: 0, y: 0, width: 4000, height: 3000});
    expect(t).toHaveLength(5);
    for (const tile of t.slice(1)) {
      expect(tile.width).toBe(2400);
      expect(tile.height).toBe(1800);
    }
    expect(t.slice(1).map((r) => [r.x, r.y])).toEqual([[0, 0], [1600, 0], [0, 1200], [1600, 1200]]);
  });

  it('skips the quarters for small images', () => {
    expect(tiles(500, 400)).toEqual([{x: 0, y: 0, width: 500, height: 400}]);
  });
});

describe('mergeBoxes', () => {
  const b = (left: number, top: number, size: number): Box => ({left, top, right: left + size, bottom: top + size});

  it('keeps separate faces', () => {
    expect(mergeBoxes([b(0, 0, 100), b(500, 500, 100)])).toHaveLength(2);
  });

  it('drops the same face found again in an overlapping tile', () => {
    expect(mergeBoxes([b(100, 100, 100), b(105, 102, 98)])).toEqual([b(100, 100, 100)]);
  });

  it('drops a box mostly inside a bigger one', () => {
    expect(mergeBoxes([b(120, 120, 40), b(100, 100, 100)])).toEqual([b(100, 100, 100)]);
  });

  it('handles no boxes', () => {
    expect(mergeBoxes([])).toEqual([]);
  });
});
