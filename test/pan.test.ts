import {describe, expect, it} from 'vitest';
import {facePan, MAX_SCALE, maxPan, MIN_SCALE, PAN_EASING, randomPan} from '../src/screensaver/pan';

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
  it('zooms gently, 1.15x to 1.35x', () => {
    expect([MIN_SCALE, MAX_SCALE]).toEqual([1.15, 1.35]);
    expect(randomPan(1000, 800, seq(0)).scale).toBeCloseTo(1.15, 6);
    expect(randomPan(1000, 800, seq(1)).scale).toBeCloseTo(1.35, 6);
  });

  it('pans 50-90% of the way to the edges, in a random direction', () => {
    const low = randomPan(1000, 800, seq(0.5, 0, 0, 0, 0));
    expect(low.scale).toBeCloseTo(1.25, 6);
    expect(Math.abs(Math.abs(low.x) - 0.5 * maxPan(1.25, 1000))).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.abs(low.y) - 0.5 * maxPan(1.25, 800))).toBeLessThanOrEqual(1);

    const high = randomPan(1000, 800, seq(0.5, 0.999, 0.999, 0.999, 0.999));
    expect(Math.abs(Math.abs(high.x) - 0.9 * maxPan(1.25, 1000))).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.abs(high.y) - 0.9 * maxPan(1.25, 800))).toBeLessThanOrEqual(1);
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

describe('pan timing', () => {
  it('moves at a constant speed', () => {
    expect(PAN_EASING).toBe('linear');
  });
});

describe('facePan', () => {
  it('zooms toward the faces, at most 1.4x', () => {
    expect(facePan({x: 0, y: 0, width: 100, height: 100}, 1000, 800).scale).toBe(1.4);
    // a face box filling 80% of the height can only zoom 1.25x
    expect(facePan({x: 0, y: 0, width: 300, height: 640}, 1000, 800).scale).toBeCloseTo(1.25, 6);
  });

  it('never zooms out for a face bigger than the screen', () => {
    const p = facePan({x: 0, y: -50, width: 900, height: 1000}, 1000, 800);
    expect(p).toEqual({scale: 1, x: 0, y: 0});
  });

  it('centres the face when it can, otherwise pans as far as the edge allows', () => {
    // face slightly left of centre: centred exactly
    expect(facePan({x: -40, y: 30, width: 100, height: 100}, 1000, 800)).toMatchObject({x: 40, y: -30});
    // face near the top: pans down to the edge limit
    const p = facePan({x: 0, y: -350, width: 100, height: 100}, 1000, 800);
    expect(p.y).toBeCloseTo(maxPan(1.4, 800), 6);
    expect(p.x).toBe(0);
  });
});
