import {describe, expect, it} from 'vitest';
import {idleTimeUnits, transitionTimeUnits, withDisplay, withUnit} from '../src/options/units';

describe('slider units', () => {
  const idle = idleTimeUnits();
  const trans = transitionTimeUnits();

  it('display change sets base from the unit multiplier', () => {
    expect(withDisplay(idle, {base: 5, display: 5, unit: 0}, 12)).toEqual({base: 12, display: 12, unit: 0});
    expect(withDisplay(idle, {base: 60, display: 1, unit: 1}, 3)).toEqual({base: 180, display: 3, unit: 1});
    expect(withDisplay(trans, {base: 60, display: 1, unit: 1}, 2)).toEqual({base: 120, display: 2, unit: 1});
  });

  it('display change clamps and rounds to the unit range', () => {
    expect(withDisplay(trans, {base: 30, display: 30, unit: 0}, 5)).toEqual({base: 10, display: 10, unit: 0});
    expect(withDisplay(idle, {base: 5, display: 5, unit: 0}, 999)).toEqual({base: 60, display: 60, unit: 0});
    expect(withDisplay(idle, {base: 5, display: 5, unit: 0}, 7.6)).toEqual({base: 8, display: 8, unit: 0});
    expect(withDisplay(idle, {base: 5, display: 5, unit: 0}, NaN)).toEqual({base: 1, display: 1, unit: 0});
  });

  it('unit change keeps the number, clamped to the new range', () => {
    // 30 seconds -> 30 minutes
    expect(withUnit(trans, {base: 30, display: 30, unit: 0}, 1)).toEqual({base: 1800, display: 30, unit: 1});
    // 45 minutes -> hours: max 24
    expect(withUnit(idle, {base: 45, display: 45, unit: 0}, 1)).toEqual({base: 1440, display: 24, unit: 1});
    // 2 minutes -> seconds: min 10
    expect(withUnit(trans, {base: 120, display: 2, unit: 1}, 0)).toEqual({base: 10, display: 10, unit: 0});
    expect(withUnit(idle, {base: 2, display: 2, unit: 0}, 2)).toEqual({base: 2880, display: 2, unit: 2});
  });

  it('a bad stored unit index falls back to the first unit', () => {
    expect(withDisplay(idle, {base: 5, display: 5, unit: 9}, 5)).toEqual({base: 5, display: 5, unit: 0});
  });
});
