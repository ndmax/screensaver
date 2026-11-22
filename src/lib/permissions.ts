/**
 * Optional permissions.
 *
 * Ported from scripts/permissions.ts. The weather, Google Photos and face
 * detection permissions are gone: photos are local files, readable through
 * the file:///* host permission.
 */

import * as Log from './log';
import * as Settings from './settings';
import type {PermState} from './settings';

/** An optional permission set */
export interface PermType {
  /** Setting that records the user's choice */
  name: 'permBackground';
  /** API permissions */
  permissions: chrome.runtime.ManifestOptionalPermission[];
  /** Host match patterns, must also be in optional_host_permissions */
  origins: string[];
}

/** Run Chrome in the background */
export const BACKGROUND: PermType = {
  name: 'permBackground',
  permissions: ['background'],
  origins: [],
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
