/**
 * Misc. utilities.
 *
 * Ported from @opus1269/chrome-ext-utils utils.ts and scripts/my_utils.ts.
 */

import {localize} from './locale';

/** True for `vite build --mode development` */
export const DEBUG = import.meta.env.DEV || import.meta.env.MODE === 'development';

export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

export function isWhiteSpace(str: string | null | undefined): boolean {
  return !str || /^\s*$/.test(str);
}

/** Fisher-Yates shuffle, in place */
export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** @throws An Error if the browser reports it is offline */
export function checkNetworkConnection(): void {
  if (!navigator.onLine) {
    throw new Error(localize('err_no_internet', 'Internet disconnected'));
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getOS(): Promise<string> {
  try {
    const info = await chrome.runtime.getPlatformInfo();
    return info.os;
  } catch {
    // linux has been known to fail this call
    return 'unknown';
  }
}

export async function isWindows(): Promise<boolean> {
  return (await getOS()) === 'win';
}

/** Error message from an unknown thrown value */
export function errMsg(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === 'string' ? err : String(err);
}
