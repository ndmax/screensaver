/**
 * Error logging. Errors go to the console, and the most recent one is kept
 * in storage for the options page's error viewer.
 */

import {localize} from './locale';

export interface LastError {
  title: string;
  message: string;
  stack: string;
  /** ms since epoch */
  time: number;
}

const KEY = 'lastError';

export async function loadLastError(): Promise<LastError | null> {
  const res = await chrome.storage.local.get(KEY);
  const value = res[KEY] as LastError | undefined;
  return value && value.message ? value : null;
}

async function saveLastError(err: LastError): Promise<void> {
  await chrome.storage.local.set({[KEY]: err});
}

export async function resetLastError(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/**
 * Log an error to the console and persist it as the last error.
 *
 * @param msg - error message
 * @param method - where it happened
 * @param title - optional user facing title
 */
export function error(msg: string, method: string, title?: string): void {
  const message = msg || localize('err_unknown', 'unknown');
  console.error(`${method}: ${message}`);
  saveLastError({
    title: title || localize('err_error', 'An error occurred'),
    message,
    stack: new Error().stack ?? '',
    time: Date.now(),
  }).catch(() => {});
}

/**
 * Log an error to the console only. Use for failures that are not
 * interesting to the user.
 */
export function warn(msg: string, method: string): void {
  console.warn(`${method}: ${msg}`);
}
