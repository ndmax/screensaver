/** Slider units for settings stored as a UnitValue. */

import {localize} from '../lib/locale';
import type {UnitValue} from '../lib/settings';

export interface Unit {
  /** Localized unit name */
  name: string;
  min: number;
  max: number;
  step: number;
  /** Multiplier from this unit to the setting's base unit */
  mult: number;
}

function unit(key: string, min: number, max: number, step: number, mult: number): Unit {
  return {name: localize(key, key), min, max, step, mult};
}

/** idleTime units, base is minutes */
export function idleTimeUnits(): Unit[] {
  return [
    unit('minutes', 1, 60, 1, 1),
    unit('hours', 1, 24, 1, 60),
    unit('days', 1, 365, 1, 1440),
  ];
}

/** transitionTime units, base is seconds */
export function transitionTimeUnits(): Unit[] {
  return [
    unit('seconds', 10, 60, 1, 1),
    unit('minutes', 1, 60, 1, 60),
    unit('hours', 1, 24, 1, 3600),
    unit('days', 1, 365, 1, 86400),
  ];
}

function clamp(n: number, u: Unit): number {
  return Math.min(Math.max(n, u.min), u.max);
}

/** New value after the slider (display value) changes */
export function withDisplay(units: Unit[], value: UnitValue, display: number): UnitValue {
  const u = units[value.unit] ?? units[0];
  const d = clamp(Number.isFinite(display) ? Math.round(display) : u.min, u);
  return {base: d * u.mult, display: d, unit: units.indexOf(u)};
}

/**
 * New value after the unit changes. The display number is kept and clamped
 * to the new unit's range, as in the original.
 */
export function withUnit(units: Unit[], value: UnitValue, unitIdx: number): UnitValue {
  const u = units[unitIdx] ?? units[0];
  const d = clamp(value.display, u);
  return {base: d * u.mult, display: d, unit: units.indexOf(u)};
}
