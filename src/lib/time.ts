/**
 * Time-of-day helpers for 'HH:MM' (24 hour) strings.
 *
 * Ported from @opus1269/chrome-ext-utils time.ts.
 */

/** Default time */
export const DEF_TIME = '00:00';

/** Clock display format for the screensaver */
export const TIME_FORMAT = {
  NONE: 0,
  HR_12: 1,
  HR_24: 2,
} as const;
export type TimeFormat = (typeof TIME_FORMAT)[keyof typeof TIME_FORMAT];

export const MSEC_IN_MIN = 60 * 1000;
export const MIN_IN_DAY = 60 * 24;
export const MSEC_IN_DAY = MIN_IN_DAY * MSEC_IN_MIN;

/** Parse 'HH:MM' into hours and minutes */
function parse(timeString: string): {hr: number; min: number} {
  return {
    hr: parseInt(timeString.slice(0, 2), 10),
    min: parseInt(timeString.slice(3, 5), 10),
  };
}

/**
 * Get today's timestamp for a time of day.
 *
 * @param timeString - 'HH:MM'
 * @param now - reference time (ms since epoch)
 */
export function getTime(timeString: string, now = Date.now()): number {
  const {hr, min} = parse(timeString);
  const date = new Date(now);
  date.setHours(hr, min, 0, 0);
  return date.getTime();
}

/**
 * Minutes from now until the next occurrence of a time of day.
 *
 * @param timeString - 'HH:MM'
 * @param now - reference time (ms since epoch)
 */
export function getTimeDelta(timeString: string, now = Date.now()): number {
  let delayMin = (getTime(timeString, now) - now) / MSEC_IN_MIN;
  if (delayMin < 0) {
    delayMin += MIN_IN_DAY;
  }
  return delayMin;
}

/**
 * Is the current time between start and stop, inclusive. Handles ranges
 * that wrap past midnight. Equal start and stop means "always".
 *
 * @param start - 'HH:MM'
 * @param stop - 'HH:MM'
 * @param now - reference time (ms since epoch)
 */
export function isInRange(start: string, stop: string, now = Date.now()): boolean {
  if (start === stop) {
    return true;
  }
  const startTime = getTime(start, now);
  const stopTime = getTime(stop, now);
  if (stopTime > startTime) {
    return now >= startTime && now <= stopTime;
  }
  return now >= startTime || now <= stopTime;
}

/**
 * Format a time of day for display.
 *
 * @param timeString - 'HH:MM', or undefined for the current time
 * @param format - 12 or 24 hour
 */
export function format(timeString: string | undefined, fmt: TimeFormat): string {
  const date = new Date();
  if (timeString) {
    const {hr, min} = parse(timeString);
    date.setHours(hr, min, 0, 0);
  }
  return date.toLocaleTimeString([navigator.language, 'en-US'], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: fmt !== TIME_FORMAT.HR_24,
  });
}
