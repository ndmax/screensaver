import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as Settings from '../src/lib/settings';
import * as FolderStore from '../src/sources/folder_store';
import type {ScanIO} from '../src/sources/folders';
import {flush} from './chrome-mock';

/** A fake folder holding `n` photos named p0.jpg... */
function listing(n: number): string {
  return Array.from({length: n}, (_, i) =>
    `<script>addRow("p${i}.jpg","p${i}.jpg",0,10,"",1,"");</script>`).join('\n');
}

/** ScanIO over a map of folder URL -> photo count; missing folders fail */
function makeIO(folders: Record<string, number>, delay = 0) {
  return {
    list: vi.fn(async (url: string) => {
      if (delay) {
        await new Promise((r) => setTimeout(r, delay));
      }
      if (!(url in folders)) {
        throw new TypeError('Failed to fetch');
      }
      return listing(folders[url]);
    }),
    probe: vi.fn(() => Promise.resolve({width: 3, height: 2})),
    fileAccess: vi.fn(() => Promise.resolve(true)),
  } satisfies ScanIO;
}

async function setFolders(paths: string[]): Promise<void> {
  await Settings.set('photoFolders', paths);
  await flush();
}

const status = async (path: string) =>
  (await chrome.storage.local.get(FolderStore.statusKey(path)))[FolderStore.statusKey(path)] as FolderStore.FolderStatus | undefined;

beforeEach(async () => {
  Settings._resetForTests();
  FolderStore._resetForTests();
  await Settings.ready();
});

describe('FolderStore.sync', () => {
  it('scans added folders and deletes removed ones', async () => {
    const io = makeIO({'file:///a/': 2, 'file:///b/': 3});
    await setFolders(['/a', '/b']);
    await FolderStore.sync({rescan: false}, io);
    expect((await FolderStore.allPhotos()).length).toBe(5);
    expect(await status('/a')).toMatchObject({count: 2, skipped: 0, scanning: false});

    await setFolders(['/b']);
    await FolderStore.sync({rescan: false}, io);
    expect(await status('/a')).toBeUndefined();
    expect(Object.keys(await chrome.storage.local.get(null)).filter((k) => k.includes('/a'))).toEqual([]);
    expect((await FolderStore.allPhotos()).length).toBe(3);
  });

  it('only rescans existing folders when asked', async () => {
    const io = makeIO({'file:///a/': 2});
    await setFolders(['/a']);
    await FolderStore.sync({rescan: false}, io);
    await FolderStore.sync({rescan: false}, io);
    expect(io.list).toHaveBeenCalledTimes(1);
    await FolderStore.sync({rescan: true}, io);
    expect(io.list).toHaveBeenCalledTimes(2);
  });

  it('queues overlapping calls into one follow-up run that keeps a rescan', async () => {
    const io = makeIO({'file:///a/': 2}, 5);
    await setFolders(['/a']);
    const first = FolderStore.sync({rescan: false}, io);
    await new Promise((r) => setTimeout(r, 1)); // first run is scanning
    const second = FolderStore.sync({rescan: true}, io);
    const third = FolderStore.sync({rescan: false}, io);
    await Promise.all([first, second, third]);
    // one scan in the first run, one rescan in the merged follow-up
    expect(io.list).toHaveBeenCalledTimes(2);
  });

  it('a folder removed during its scan leaves nothing behind', async () => {
    const io = makeIO({'file:///a/': 2}, 10);
    await setFolders(['/a']);
    const run = FolderStore.sync({rescan: false}, io);
    await new Promise((r) => setTimeout(r, 2));
    await setFolders([]);
    await run;
    expect(await status('/a')).toBeUndefined();
    expect(await FolderStore.allPhotos()).toEqual([]);
  });

  it('a failed rescan keeps the previous photos and records the error', async () => {
    const io = makeIO({'file:///a/': 2});
    await setFolders(['/a']);
    await FolderStore.sync({rescan: false}, io);
    await FolderStore.sync({rescan: true}, makeIO({}));
    expect((await FolderStore.allPhotos()).length).toBe(2);
    expect(await status('/a')).toMatchObject({count: 2, error: 'folder_err_not_found', scanning: false});

    // and a good scan clears the error
    await FolderStore.sync({rescan: true}, io);
    expect((await status('/a'))?.error).toBeUndefined();
  });

  it('writes progress while scanning', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    try {
      const io = makeIO({'file:///a/': 3});
      let t = Date.now();
      io.probe.mockImplementation(() => {
        t += 3000;
        vi.setSystemTime(t);
        return Promise.resolve({width: 3, height: 2});
      });
      await setFolders(['/a']);
      const seen: FolderStore.FolderStatus[] = [];
      chrome.storage.onChanged.addListener((changes) => {
        const c = changes[FolderStore.statusKey('/a')];
        if (c?.newValue) {
          seen.push(c.newValue as FolderStore.FolderStatus);
        }
      });
      await FolderStore.sync({rescan: false}, io);
      await flush();
      expect(seen[0]).toMatchObject({scanning: true});
      expect(seen.some((s) => s.scanning && (s.found ?? 0) > 0)).toBe(true);
      expect(seen.at(-1)).toMatchObject({scanning: false, count: 3});
    } finally {
      vi.useRealTimers();
    }
  });
});
