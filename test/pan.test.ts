import {describe, expect, it} from 'vitest';
import {maxPan, randomPan} from '../src/screensaver/pan';

/** A fixed sequence of "random" numbers */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('maxPan', () => {
  it('is the translation (before scaling) that just reaches the photo edge', () => {
    // scaled 1.5x, the photo overhangs 0.25 of its width on each side;
    // translate is scaled too, so the limit is 0.25 / 1.5
    expect(maxPan(1.5, 1200)).toBeCloseTo(200, 6);
    expect(maxPan(1.0, 1200)).toBe(0);
  });
});

describe('randomPan', () => {
  it('zooms 1.2x to 1.6x', () => {
    expect(randomPan(1000, 800, seq(0)).scale).toBeCloseTo(1.2, 6);
    expect(randomPan(1000, 800, seq(1)).scale).toBeCloseTo(1.6, 6);
  });

  it('pans 50-90% of the way to the edges, in a random direction', () => {
    const low = randomPan(1000, 800, seq(0.5, 0, 0, 0, 0));
    expect(low.scale).toBeCloseTo(1.4, 6);
    expect(Math.abs(Math.abs(low.x) - 0.5 * maxPan(1.4, 1000))).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.abs(low.y) - 0.5 * maxPan(1.4, 800))).toBeLessThanOrEqual(1);

    const high = randomPan(1000, 800, seq(0.5, 0.999, 0.999, 0.999, 0.999));
    expect(Math.abs(Math.abs(high.x) - 0.9 * maxPan(1.4, 1000))).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.abs(high.y) - 0.9 * maxPan(1.4, 800))).toBeLessThanOrEqual(1);
    expect(Math.sign(low.x)).not.toBe(Math.sign(high.x));
    expect(Math.sign(low.y)).not.toBe(Math.sign(high.y));
  });

  it('never shows past the edge of the photo', () => {
    for (let i = 0; i < 500; i++) {
      const {scale, x, y} = randomPan(1197, 900);
      expect(Math.abs(x)).toBeLessThanOrEqual(maxPan(scale, 1197));
      expect(Math.abs(y)).toBeLessThanOrEqual(maxPan(scale, 900));
      expect(Math.abs(x)).toBeGreaterThan(0.45 * maxPan(scale, 1197));
    }
  });
});
