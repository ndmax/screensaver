/**
 * Scanned photos for each folder in the photoFolders setting.
 *
 * Storage, per folder path (as the user entered it):
 * - `folder:<path>`: Photo[] from the last good scan
 * - `folderStatus:<path>`: FolderStatus, shown in Options
 *
 * Scans run in the service worker. Runs are serialised: a sync() call made
 * while one is running is queued, and further calls merge into that one.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {errMsg} from '../lib/utils';
import {type ScanError, type ScanIO, scanFolder} from './folders';
import type {Photo} from './photo_source';

export interface FolderStatus {
  /** Photos from the last good scan */
  count: number;
  /** Files skipped by the last good scan */
  skipped: number;
  /** Why the last scan failed */
  error?: ScanError;
  /** Time of the last scan, ms */
  scannedAt: number;
  scanning: boolean;
  /** Photos found so far while scanning */
  found?: number;
}

const PHOTOS_PREFIX = 'folder:';
const STATUS_PREFIX = 'folderStatus:';
/** Minimum time between progress writes. Each write also keeps the service worker alive. */
const PROGRESS_MS = 2000;

export const photosKey = (path: string): string => PHOTOS_PREFIX + path;
export const statusKey = (path: string): string => STATUS_PREFIX + path;

/** Reads folders from the service worker */
export function swIO(): ScanIO {
  return {
    list: async (url) => (await fetch(url)).text(),
    probe: async (url) => {
      const blob = await (await fetch(url)).blob();
      // Decode at a small size to save memory; the aspect ratio is kept.
      const bitmap = await createImageBitmap(blob, {resizeWidth: 1024, resizeQuality: 'low'});
      try {
        return {width: bitmap.width, height: bitmap.height};
      } finally {
        bitmap.close();
      }
    },
    fileAccess: () => chrome.extension.isAllowedFileSchemeAccess(),
  };
}

/** All photos from the listed folders */
export async function allPhotos(): Promise<Photo[]> {
  const keys = Settings.get('photoFolders').map(photosKey);
  if (!keys.length) {
    return [];
  }
  const stored = await chrome.storage.local.get(keys);
  return keys.flatMap((k) => (stored[k] as Photo[] | undefined) ?? []);
}

const isListed = (path: string): boolean => Settings.get('photoFolders').includes(path);

async function scanOne(path: string, prev: Photo[], prevStatus: FolderStatus | undefined, io: ScanIO): Promise<void> {
  const base: FolderStatus = prevStatus ?? {count: 0, skipped: 0, scannedAt: 0, scanning: false};
  await chrome.storage.local.set({[statusKey(path)]: {...base, scanning: true, found: 0}});
  let lastWrite = Date.now();
  const res = await scanFolder(path, prev, {
    ...io,
    onProgress: (found) => {
      if (Date.now() - lastWrite >= PROGRESS_MS && isListed(path)) {
        lastWrite = Date.now();
        void chrome.storage.local.set({[statusKey(path)]: {...base, scanning: true, found}});
      }
    },
  });

  if (!isListed(path)) {
    // removed while scanning
    await chrome.storage.local.remove([photosKey(path), statusKey(path)]);
    return;
  }
  if (res.error) {
    Log.error(localize(res.error, res.error), 'FolderStore.scan', path);
    await chrome.storage.local.set({[statusKey(path)]: {
      count: prev.length, skipped: base.skipped, error: res.error, scannedAt: Date.now(), scanning: false,
    } satisfies FolderStatus});
    return;
  }
  try {
    await chrome.storage.local.set({
      [photosKey(path)]: res.photos,
      [statusKey(path)]: {count: res.photos.length, skipped: res.skipped, scannedAt: Date.now(), scanning: false} satisfies FolderStatus,
    });
  } catch (err) {
    Msg.broadcast({message: 'storageExceeded'});
    throw new Error(`Failed to save photos for ${path}: ${errMsg(err)}`, {cause: err});
  }
}

async function run(rescan: boolean, io: ScanIO): Promise<void> {
  await Settings.ready();
  const stored = await chrome.storage.local.get(null);
  const paths = Settings.get('photoFolders');
  const stale = Object.keys(stored).filter((k) => {
    const prefix = [PHOTOS_PREFIX, STATUS_PREFIX].find((p) => k.startsWith(p));
    return prefix && !paths.includes(k.slice(prefix.length));
  });
  if (stale.length) {
    await chrome.storage.local.remove(stale);
  }
  for (const path of paths) {
    const prev = stored[photosKey(path)] as Photo[] | undefined;
    if (prev && !rescan) {
      continue;
    }
    if (!isListed(path)) {
      continue;
    }
    try {
      await scanOne(path, prev ?? [], stored[statusKey(path)] as FolderStatus | undefined, io);
    } catch (err) {
      Log.error(errMsg(err), 'FolderStore.sync', path);
    }
  }
}

let chain: Promise<void> = Promise.resolve();
let queued: {rescan: boolean; done: Promise<void>} | null = null;

/**
 * Bring the stored photos in line with the folder list: delete removed
 * folders and scan new ones.
 *
 * @param opts.rescan - also rescan folders that were scanned before
 */
export function sync(opts: {rescan: boolean}, io: ScanIO = swIO()): Promise<void> {
  if (queued) {
    queued.rescan ||= opts.rescan;
    return queued.done;
  }
  const q = {rescan: opts.rescan, done: Promise.resolve()};
  q.done = chain.then(() => {
    queued = null;
    return run(q.rescan, io);
  });
  queued = q;
  chain = q.done.catch(() => {});
  return q.done;
}

/** Test hook: reset module state. */
export function _resetForTests(): void {
  chain = Promise.resolve();
  queued = null;
}
