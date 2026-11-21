import {describe, expect, it} from 'vitest';
import {getTimeDelta, isInRange} from '../src/lib/time';

/** Local timestamp for today at hh:mm */
function at(hh: number, mm: number): number {
  const d = new Date(2026, 0, 15);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

describe('isInRange', () => {
  it('equal start and stop means always', () => {
    expect(isInRange('09:00', '09:00', at(3, 0))).toBe(true);
  });

  it('same-day range', () => {
    expect(isInRange('09:00', '17:00', at(12, 0))).toBe(true);
    expect(isInRange('09:00', '17:00', at(8, 59))).toBe(false);
    expect(isInRange('09:00', '17:00', at(17, 0))).toBe(true);
    expect(isInRange('09:00', '17:00', at(17, 1))).toBe(false);
  });

  it('range wrapping midnight', () => {
    expect(isInRange('22:00', '06:00', at(23, 0))).toBe(true);
    expect(isInRange('22:00', '06:00', at(5, 0))).toBe(true);
    expect(isInRange('22:00', '06:00', at(12, 0))).toBe(false);
  });
});

describe('getTimeDelta', () => {
  it('later today', () => {
    expect(getTimeDelta('10:30', at(10, 0))).toBe(30);
  });

  it('wraps to tomorrow', () => {
    expect(getTimeDelta('09:00', at(10, 0))).toBe(23 * 60);
  });
});
