/**
 * Photos from local folders, read through file:// URLs.
 *
 * Needs the file:///* host permission and the user's "Allow access to file
 * URLs" switch on chrome://extensions. A directory URL returns Chrome's HTML
 * listing, one `addRow(name, href, isDir, size, sizeString, mtime, date)`
 * script per entry, which works in the service worker (no DOM needed).
 *
 * Everything that touches the browser is passed in as a ScanIO, so this
 * module is plain logic.
 */

import type {Photo} from './photo_source';

/** Deepest subfolder level scanned */
export const MAX_DEPTH = 20;
/** Images decoded at once to measure their size */
export const PROBE_CONCURRENCY = 4;

const PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp']);
/** Formats Chrome can't show; counted so the user knows they were skipped */
const SKIP_EXTS = new Set(['heic', 'heif', 'mp4', 'mov', 'm4v', 'webm', 'avi', '3gp', 'mkv']);

/** Locale keys for scan errors */
export type ScanError = 'folder_err_no_access' | 'folder_err_not_found' | 'folder_err_subfolder' | 'folder_err_empty';

export interface Entry {
  /** Decoded name */
  name: string;
  /** URL-encoded name, relative to the directory */
  href: string;
  isDir: boolean;
  size: number;
  /** Unix seconds */
  mtime: number;
}

export interface ScanIO {
  /** Fetch a directory listing; rejects if it can't be read */
  list(url: string): Promise<string>;
  /** Displayed (EXIF-rotated) size of an image; rejects if it can't be decoded */
  probe(url: string): Promise<{width: number; height: number}>;
  /** Is Chrome's "Allow access to file URLs" on */
  fileAccess(): Promise<boolean>;
  /** Called as photos are found */
  onProgress?(found: number): void;
}

export interface ScanResult {
  photos: Photo[];
  /** Videos, HEIC/HEIF and images that failed to decode */
  skipped: number;
  /** Set when the scan failed; photos are then the previous ones */
  error?: ScanError;
}

const ROW_RE = /<script>addRow\((.*)\);<\/script>/g;

/** Parse Chrome's directory listing page */
export function parseListing(html: string): Entry[] {
  const entries: Entry[] = [];
  for (const [, args] of html.matchAll(ROW_RE)) {
    try {
      const [name, href, isDir, size, , mtime] = JSON.parse(`[${args}]`) as [string, string, number, number, string, number];
      if (name !== '..') {
        entries.push({name, href, isDir: isDir === 1, size, mtime});
      }
    } catch {
      // not a row we understand
    }
  }
  return entries;
}

const WIN_DRIVE_RE = /^[A-Za-z]:[\\/]/;

/** Path segments, with Windows separators converted and empty segments dropped */
function segments(path: string): {drive: string; parts: string[]} {
  const p = path.trim();
  if (WIN_DRIVE_RE.test(p)) {
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return {drive: parts[0], parts: parts.slice(1)};
  }
  return {drive: '', parts: p.split('/').filter(Boolean)};
}

/** A path for comparisons: forward slashes, no trailing slash */
function normalize(path: string): string {
  const {drive, parts} = segments(path);
  return `${drive}/${parts.join('/')}`;
}

/** A folder path as a file:// URL ending in '/' */
export function pathToUrl(path: string): string {
  const {drive, parts} = segments(path);
  const encoded = parts.map(encodeURIComponent);
  const all = drive ? [drive, ...encoded] : encoded;
  return all.length ? `file:///${all.join('/')}/` : 'file:///';
}

/** Last segment of a path, or the path itself for a root */
function baseName(path: string): string {
  const {drive, parts} = segments(path);
  return parts.at(-1) ?? (drive || path.trim());
}

/** Is a file a photo, a format we skip but count, or not of interest */
export function classify(name: string): 'photo' | 'skip' | 'ignore' {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return 'ignore';
  }
  const ext = name.slice(dot + 1).toLowerCase();
  return PHOTO_EXTS.has(ext) ? 'photo' : SKIP_EXTS.has(ext) ? 'skip' : 'ignore';
}

/** Why a path can't be added to the list, or null if it can */
export function validateNewPath(path: string, existing: readonly string[]): 'empty' | 'duplicate' | 'nested' | null {
  if (!path.trim()) {
    return 'empty';
  }
  const n = normalize(path);
  const within = (a: string, b: string) => b === '/' || a.startsWith(`${b}/`);
  for (const e of existing) {
    const ne = normalize(e);
    if (n === ne) {
      return 'duplicate';
    }
    if (within(n, ne) || within(ne, n)) {
      return 'nested';
    }
  }
  return null;
}

interface Candidate {
  url: string;
  author: string;
  size: number;
  mtime: number;
}

/** Run fn over items, at most `limit` at a time */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      await fn(items[next++]);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
}

/**
 * Scan a folder and its subfolders for photos.
 *
 * On failure the previous photos are returned with an error, so a drive
 * that is briefly missing doesn't empty the slideshow. Zero photos where
 * there were some before also counts as a failure: an unmounted mount point
 * lists as an empty folder.
 *
 * @param prev - photos from the last scan; unchanged files reuse their asp
 */
export async function scanFolder(root: string, prev: readonly Photo[], io: ScanIO): Promise<ScanResult> {
  const failed = (error: ScanError): ScanResult => ({photos: [...prev], skipped: 0, error});
  const rootUrl = pathToUrl(root);
  const rootName = baseName(root);

  let skipped = 0;
  const candidates: Candidate[] = [];
  // Listings already seen. A symlink back up the tree has a new URL but
  // lists the same entries, so key on the content.
  const seen = new Set<string>();
  const queue: {url: string; rel: string[]}[] = [{url: rootUrl, rel: []}];
  while (queue.length) {
    const dir = queue.shift()!;
    let html: string;
    try {
      html = await io.list(dir.url);
    } catch {
      if (dir.url !== rootUrl) {
        return failed('folder_err_subfolder');
      }
      return failed(await io.fileAccess() ? 'folder_err_not_found' : 'folder_err_no_access');
    }
    const entries = parseListing(html);
    const signature = JSON.stringify(entries);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);

    for (const e of entries) {
      if (e.name.startsWith('.')) {
        continue;
      }
      if (e.isDir) {
        if (dir.rel.length < MAX_DEPTH) {
          queue.push({url: `${dir.url}${e.href}/`, rel: [...dir.rel, e.name]});
        }
        continue;
      }
      const kind = classify(e.name);
      if (kind === 'photo') {
        candidates.push({
          url: dir.url + e.href,
          author: dir.rel.length ? dir.rel.join(' / ') : rootName,
          size: e.size,
          mtime: e.mtime,
        });
      } else if (kind === 'skip') {
        skipped++;
      }
    }
  }

  const prevByUrl = new Map(prev.map((p) => [p.url, p]));
  const photos: Photo[] = [];
  await pool(candidates, PROBE_CONCURRENCY, async (c) => {
    const old = prevByUrl.get(c.url);
    let asp = old && old.size === c.size && old.mtime === c.mtime ? old.asp : '';
    if (!asp) {
      try {
        const {width, height} = await io.probe(c.url);
        if (!width || !height) {
          throw new Error('empty image');
        }
        asp = (width / height).toPrecision(3);
      } catch {
        skipped++;
        return;
      }
    }
    photos.push({...c, asp});
    io.onProgress?.(photos.length);
  });

  if (!photos.length && prev.length) {
    return failed('folder_err_empty');
  }
  photos.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return {photos, skipped};
}
