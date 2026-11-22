// Zips dist/ into release/photo-screensaver-<version>.zip for upload to the
// Chrome Web Store. Run through `npm run package`, which builds first.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/manifest.json not found; run `npm run build` first.');
  process.exit(1);
}

const {version} = readJson(join(dist, 'manifest.json'));
const pkgVersion = readJson(join(root, 'package.json')).version;
if (version !== pkgVersion) {
  console.error(`Version mismatch: manifest.json has ${version}, package.json has ${pkgVersion}.`);
  process.exit(1);
}

const outDir = join(root, 'release');
const zipPath = join(outDir, `photo-screensaver-${version}.zip`);
mkdirSync(outDir, {recursive: true});
rmSync(zipPath, {force: true});

// Zip from inside dist/ so manifest.json sits at the root of the archive.
execFileSync('zip', ['-r', '-q', '-X', zipPath, '.', '-x', '*.map', '.DS_Store'],
  {cwd: dist, stdio: 'inherit'});

console.log(`Wrote ${zipPath}`);
