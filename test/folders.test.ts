import {describe, expect, it, vi} from 'vitest';
import {
  classify, MAX_DEPTH, parseListing, pathToUrl, scanFolder, type ScanIO, validateNewPath,
} from '../src/sources/folders';
import type {Photo} from '../src/sources/photo_source';
import listing from './fixtures/listing.html?raw';

describe('parseListing', () => {
  it('reads a real Chromium directory listing', () => {
    expect(parseListing(listing)).toEqual([
      {name: '.hidden', href: '.hidden', isDir: true, size: 40, mtime: 1795362146},
      {name: 'Day 1', href: 'Day%201', isDir: true, size: 40, mtime: 1795362146},
      {name: '.DS_Store', href: '.DS_Store', isDir: false, size: 0, mtime: 1795362146},
      {name: 'a photo.png', href: 'a%20photo.png', isDir: false, size: 22918, mtime: 1795362146},
      {name: 'a photo.png.json', href: 'a%20photo.png.json', isDir: false, size: 3, mtime: 1795362146},
      {name: 'Café #2.JPG', href: 'Caf%C3%A9%20%232.JPG', isDir: false, size: 1965, mtime: 1795362146},
    ]);
  });

  it('handles quotes in names and ignores other markup', () => {
    const html = '<script>addRow("say \\"hi\\".jpg","say%20%22hi%22.jpg",0,5,"5 B",7,"x");</script>';
    expect(parseListing(html)).toEqual([{name: 'say "hi".jpg', href: 'say%20%22hi%22.jpg', isDir: false, size: 5, mtime: 7}]);
    expect(parseListing('<html>not a listing</html>')).toEqual([]);
  });
});

describe('pathToUrl', () => {
  it('encodes each segment and ends with a slash', () => {
    expect(pathToUrl('/home/a b/#1')).toBe('file:///home/a%20b/%231/');
    expect(pathToUrl('  /home/me/Café?/  ')).toBe('file:///home/me/Caf%C3%A9%3F/');
    expect(pathToUrl('/pics//')).toBe('file:///pics/');
    expect(pathToUrl('/')).toBe('file:///');
    expect(pathToUrl('/a/100%')).toBe('file:///a/100%25/');
  });

  it('converts Windows paths', () => {
    expect(pathToUrl('C:\\Pics')).toBe('file:///C:/Pics/');
    expect(pathToUrl('d:/My Pics\\2019')).toBe('file:///d:/My%20Pics/2019/');
  });
});

describe('classify', () => {
  it('sorts files into photos, counted skips and ignored files', () => {
    expect(classify('A.JPG')).toBe('photo');
    for (const n of ['a.jpeg', 'a.png', 'a.webp', 'a.gif', 'a.avif', 'a.bmp']) {
      expect(classify(n)).toBe('photo');
    }
    for (const n of ['x.heic', 'x.HEIF', 'x.mp4', 'x.MOV', 'x.m4v', 'x.webm', 'x.avi', 'x.3gp', 'x.mkv']) {
      expect(classify(n)).toBe('skip');
    }
    for (const n of ['x.json', 'notes.txt', 'noext', 'jpg']) {
      expect(classify(n)).toBe('ignore');
    }
  });
});

describe('validateNewPath', () => {
  const list = ['/home/me/Pics', 'C:\\Photos\\'];
  it('rejects empty, duplicate and nested paths', () => {
    expect(validateNewPath('  ', list)).toBe('empty');
    expect(validateNewPath('/home/me/Pics/', list)).toBe('duplicate');
    expect(validateNewPath('C:/Photos', list)).toBe('duplicate');
    expect(validateNewPath('/home/me/Pics/2019', list)).toBe('nested');
    expect(validateNewPath('/home/me', list)).toBe('nested');
    expect(validateNewPath('/', list)).toBe('nested');
  });

  it('accepts siblings with a shared prefix', () => {
    expect(validateNewPath('/home/me/Pics2', list)).toBeNull();
    expect(validateNewPath('/home/me/Pic', list)).toBeNull();
  });
});

/** A directory tree for a fake ScanIO; files are [size, mtime, width, height] */
type Tree = {[name: string]: Tree | [number, number, number, number]};

function row(name: string, isDir: boolean, size: number, mtime: number): string {
  return `<script>addRow(${JSON.stringify(name)},${JSON.stringify(encodeURIComponent(name))},${isDir ? 1 : 0},${size},"",${mtime},"");</script>`;
}

function fakeIO(root: string, tree: Tree, opts: {access?: boolean; failList?: string[]; failProbe?: string[]; loop?: string} = {}) {
  const dirs = new Map<string, string>();
  const files = new Map<string, [number, number]>();
  const walk = (url: string, t: Tree): void => {
    const rows: string[] = [];
    for (const [name, v] of Object.entries(t)) {
      const child = url + encodeURIComponent(name);
      if (Array.isArray(v)) {
        rows.push(row(name, false, v[0], v[1]));
        files.set(child, [v[2], v[3]]);
      } else {
        rows.push(row(name, true, 0, 0));
        walk(`${child}/`, v);
      }
    }
    if (opts.loop && url === pathToUrl(root)) {
      // a symlink back to the root lists the same entries as the root
      rows.push(row(opts.loop, true, 0, 0));
    }
    dirs.set(url, rows.join('\n'));
  };
  walk(pathToUrl(root), tree);
  const io = {
    list: vi.fn((url: string) => {
      if (opts.access === false || opts.failList?.some((f) => url.endsWith(f))) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      if (opts.loop && url.includes(encodeURIComponent(opts.loop))) {
        return Promise.resolve(dirs.get(pathToUrl(root))!);
      }
      const html = dirs.get(url);
      return html === undefined ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(html);
    }),
    probe: vi.fn((url: string) => {
      const f = files.get(url);
      if (!f || opts.failProbe?.some((p) => url.endsWith(p))) {
        return Promise.reject(new Error('decode'));
      }
      return Promise.resolve({width: f[0], height: f[1]});
    }),
    fileAccess: vi.fn(() => Promise.resolve(opts.access !== false)),
    onProgress: vi.fn(),
  } satisfies ScanIO;
  return io;
}

const TREE: Tree = {
  'top.jpg': [100, 1, 300, 200],
  'Hawaii 2019': {
    'a.png': [200, 2, 400, 200],
    'Day 1': {'rot.jpg': [300, 3, 200, 400]},
  },
  'clip.mp4': [1, 1, 0, 0],
  'x.heic': [1, 1, 0, 0],
  'top.jpg.json': [1, 1, 0, 0],
  '.hidden': {'h.jpg': [1, 1, 10, 10]},
  '.dot.jpg': [1, 1, 10, 10],
};

const byUrl = (photos: Photo[]) => Object.fromEntries(photos.map((p) => [p.url, p]));

describe('scanFolder', () => {
  it('walks subfolders, labels by folder and counts skips', async () => {
    const io = fakeIO('/pics/root', TREE);
    const res = await scanFolder('/pics/root', [], io);
    expect(res.error).toBeUndefined();
    expect(res.skipped).toBe(2);
    expect(byUrl(res.photos)).toEqual({
      'file:///pics/root/top.jpg': {url: 'file:///pics/root/top.jpg', author: 'root', asp: '1.50', size: 100, mtime: 1},
      'file:///pics/root/Hawaii%202019/a.png': {url: 'file:///pics/root/Hawaii%202019/a.png', author: 'Hawaii 2019', asp: '2.00', size: 200, mtime: 2},
      'file:///pics/root/Hawaii%202019/Day%201/rot.jpg': {url: 'file:///pics/root/Hawaii%202019/Day%201/rot.jpg', author: 'Hawaii 2019 / Day 1', asp: '0.500', size: 300, mtime: 3},
    });
    expect(io.onProgress).toHaveBeenCalled();
  });

  it('reuses the aspect ratio of unchanged files', async () => {
    const first = await scanFolder('/pics/root', [], fakeIO('/pics/root', TREE));
    const prev = first.photos.map((p) => (p.author === 'root' ? {...p, asp: '9.99'} : p));
    const changed = prev.map((p) => (p.author === 'Hawaii 2019' ? {...p, mtime: 0} : p));
    const io = fakeIO('/pics/root', TREE);
    const res = await scanFolder('/pics/root', changed, io);
    expect(io.probe).toHaveBeenCalledTimes(1);
    expect(io.probe).toHaveBeenCalledWith('file:///pics/root/Hawaii%202019/a.png');
    expect(byUrl(res.photos)['file:///pics/root/top.jpg'].asp).toBe('9.99');
  });

  it('counts images that fail to decode as skipped', async () => {
    const res = await scanFolder('/pics/root', [], fakeIO('/pics/root', TREE, {failProbe: ['a.png']}));
    expect(res.photos).toHaveLength(2);
    expect(res.skipped).toBe(3);
  });

  it('reports file access off, or a missing folder, keeping previous photos', async () => {
    const prev: Photo[] = [{url: 'file:///pics/root/old.jpg', author: 'root', asp: '1.00'}];
    const off = await scanFolder('/pics/root', prev, fakeIO('/pics/root', TREE, {access: false}));
    expect(off).toEqual({photos: prev, skipped: 0, error: 'folder_err_no_access'});
    const missing = await scanFolder('/pics/gone', prev, fakeIO('/pics/root', TREE));
    expect(missing).toEqual({photos: prev, skipped: 0, error: 'folder_err_not_found'});
  });

  it('fails the whole scan if a subfolder cannot be listed', async () => {
    const prev: Photo[] = [{url: 'file:///pics/root/old.jpg', author: 'root', asp: '1.00'}];
    const res = await scanFolder('/pics/root', prev, fakeIO('/pics/root', TREE, {failList: ['Day%201/']}));
    expect(res).toEqual({photos: prev, skipped: 0, error: 'folder_err_subfolder'});
  });

  it('treats zero photos as a failure only if there were photos before', async () => {
    const prev: Photo[] = [{url: 'file:///pics/empty/old.jpg', author: 'empty', asp: '1.00'}];
    const io = fakeIO('/pics/empty', {'x.json': [1, 1, 0, 0]});
    expect(await scanFolder('/pics/empty', prev, io)).toEqual({photos: prev, skipped: 0, error: 'folder_err_empty'});
    expect(await scanFolder('/pics/empty', [], io)).toEqual({photos: [], skipped: 0});
  });

  it('does not follow a symlink loop', async () => {
    const io = fakeIO('/pics/root', TREE, {loop: 'again'});
    const res = await scanFolder('/pics/root', [], io);
    expect(res.photos).toHaveLength(3);
    expect(io.list.mock.calls.length).toBeLessThan(MAX_DEPTH);
  });
});
