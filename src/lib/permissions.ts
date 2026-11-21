/**
 * Optional permissions.
 *
 * Ported from scripts/permissions.ts. The weather permission is gone; the
 * Google Photos permission returns with the Picker API source.
 */

import * as Log from './log';
import * as Settings from './settings';
import type {PermState} from './settings';

/** An optional permission set */
export interface PermType {
  /** Setting that records the user's choice */
  name: 'permBackground' | 'permDetectFaces';
  /** API permissions */
  permissions: chrome.runtime.ManifestOptionalPermission[];
  /** Host match patterns, must also be in optional_host_permissions */
  origins: string[];
}

const UNSPLASH_SOURCE_ORIGIN = 'https://images.unsplash.com/*';

/** Run Chrome in the background */
export const BACKGROUND: PermType = {
  name: 'permBackground',
  permissions: ['background'],
  origins: [],
};

/**
 * Read pixels from photo hosts so faces can be detected. Image hosts are
 * added here as their photo sources are restored.
 */
export const DETECT_FACES: PermType = {
  name: 'permDetectFaces',
  permissions: [],
  origins: [UNSPLASH_SOURCE_ORIGIN],
};

export function notSet(type: PermType): boolean {
  return Settings.get(type.name) === 'notSet';
}

export function isAllowed(type: PermType): boolean {
  return Settings.get(type.name) === 'allowed';
}

async function setState(type: PermType, value: PermState): Promise<void> {
  await Settings.set(type.name, value);
}

function toRequest(type: PermType): chrome.permissions.Permissions {
  return {permissions: type.permissions, origins: type.origins};
}

/** Does Chrome currently grant the permission set */
export async function contains(type: PermType): Promise<boolean> {
  return chrome.permissions.contains(toRequest(type));
}

/**
 * Request an optional permission. Must be called from a user gesture in an
 * extension page.
 *
 * @returns true if granted
 */
export async function request(type: PermType): Promise<boolean> {
  try {
    const granted = await chrome.permissions.request(toRequest(type));
    if (granted) {
      await setState(type, 'allowed');
    } else {
      await setState(type, 'denied');
      await remove(type).catch(() => {});
    }
    return granted;
  } catch (err) {
    Log.error(err instanceof Error ? err.message : String(err), 'Permissions.request');
    throw err;
  }
}

/**
 * Remove an optional permission.
 *
 * @returns true if removed
 */
export async function remove(type: PermType): Promise<boolean> {
  let removed = false;
  if (await contains(type)) {
    removed = await chrome.permissions.remove(toRequest(type));
  }
  if (removed) {
    await setState(type, 'notSet');
  }
  return removed;
}

/** Remove an optional permission and record that the user denied it. */
export async function deny(type: PermType): Promise<boolean> {
  const removed = await remove(type);
  await setState(type, 'denied');
  return removed;
}

/**
 * Is a url covered by one of the permission's host patterns.
 *
 * Fixes the original, which trimmed the origin using an index computed from
 * the url string and so only matched by coincidence.
 */
export function isInOrigins(url: string, type: PermType): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  for (const origin of type.origins) {
    const match = /^(https?):\/\/(\*\.)?([^/]+)\//.exec(origin);
    if (!match || `${match[1]}:` !== parsed.protocol) {
      continue;
    }
    const [, , wildcard, host] = match;
    if (parsed.hostname === host || (wildcard && parsed.hostname.endsWith(`.${host}`))) {
      return true;
    }
  }
  return false;
}
