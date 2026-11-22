/** Misc. utilities. */

/** True for `vite build --mode development` */
export const DEBUG = import.meta.env.DEV || import.meta.env.MODE === 'development';

export function getVersion(): string {
  return chrome.runtime.getManifest().version;
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

export async function isWindows(): Promise<boolean> {
  try {
    return (await chrome.runtime.getPlatformInfo()).os === 'win';
  } catch {
    // linux has been known to fail this call
    return false;
  }
}

/** Error message from an unknown thrown value */
export function errMsg(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === 'string' ? err : String(err);
}
