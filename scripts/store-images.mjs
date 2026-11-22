/**
 * Makes the Chrome Web Store screenshots (1280×800) and promo tiles from the
 * built extension, using public-domain / CC0 photos from Wikimedia Commons.
 *
 *   npm run store-images
 *
 * Photos are downloaded once into store/photos/ (git ignores it). Output goes
 * to store/. Needs the same Chromium as the browser tests (test/e2e/README.md).
 */

import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {launch, waitFor} from '../test/e2e/harness.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const STORE = join(ROOT, 'store');
const CACHE = join(STORE, 'photos');

/** Photos: Wikimedia Commons file, local folder/name. Credits are in store/README.md */
const PHOTOS = [
  {commons: 'Murlough bay (48770060832).jpg', file: 'Northern Ireland/murlough-bay.jpg'},
  {commons: 'Bourtzi castle harbour Karystos Euboea Greece.jpg', file: 'Greece/karystos-harbour.jpg'},
  {commons: 'Mount Ida chain Messara plain from Phaistos Crete Greece.jpg', file: 'Greece/messara-plain.jpg'},
  {commons: 'Sunset over Trommekilen from Norrkila 6.jpg', file: 'Sweden/trommekilen-sunset.jpg'},
  {commons: 'Beech and ferns in Gullmarsskogen.jpg', file: 'Sweden/gullmarsskogen.jpg'},
  {commons: 'San Juan Valley.jpg', file: 'Venezuela/san-juan-valley.jpg'},
  {commons: 'Utah Dunes Landscape - West Desert District.jpg', file: 'Utah/west-desert-dunes.jpg'},
];
const FOLDERS = [...new Set(PHOTOS.map((p) => dirname(p.file)))];

const VIEW = {LETTERBOX: 0, ZOOM: 1, FRAME: 2};
const TIME_12HR = 1;
const UA = {'User-Agent': 'store-image-script/1.0'};

async function download() {
  for (const {commons, file} of PHOTOS) {
    const out = join(CACHE, file);
    if (existsSync(out)) {
      continue;
    }
    const api = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1920', titles: `File:${commons}`,
    });
    const info = await (await fetch(api, {headers: UA})).json();
    const {thumburl} = Object.values(info.query.pages)[0].imageinfo[0];
    const img = await fetch(thumburl, {headers: UA});
    if (!img.ok) {
      throw new Error(`${commons}: HTTP ${img.status}`);
    }
    mkdirSync(dirname(out), {recursive: true});
    writeFileSync(out, Buffer.from(await img.arrayBuffer()));
    console.log(`downloaded ${file}`);
  }
}

const dataUri = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;

await download();
mkdirSync(join(STORE, 'screenshots'), {recursive: true});

// copy the photos to a short temp path, which is what the Options page shows
const tmp = mkdtempSync(join(tmpdir(), 'photos-'));
for (const {file} of PHOTOS) {
  mkdirSync(join(tmp, dirname(file)), {recursive: true});
  copyFileSync(join(CACHE, file), join(tmp, file));
}

const {browser, sw} = await launch({viewport: {width: 1280, height: 800}});
const extId = new URL(sw.url()).host;
// first install writes the default settings, then opens Options; wait for
// that so the defaults don't overwrite the settings set below
const installed = await browser.waitForTarget((t) => t.url().endsWith('/options.html'), {timeout: 15000});
await (await installed.page())?.close();
const storage = (keys = null) => sw.evaluate((k) => chrome.storage.local.get(k), keys);
const set = (items) => sw.evaluate((i) => chrome.storage.local.set(i), items);

/** Point the extension at these folders and wait until they are scanned */
async function useFolders(folders) {
  const paths = folders.map((f) => join(tmp, f));
  await set({photoFolders: paths});
  await sw.evaluate(() => chrome.alarms.create('UPDATE_PHOTOS', {when: Date.now() + 50}));
  try {
    await waitFor(async () => {
      const s = await storage(paths.map((p) => `folder:${p}`));
      return paths.every((p) => s[`folder:${p}`]?.length > 0);
    }, 20000);
  } catch (err) {
    const all = await storage();
    console.log(JSON.stringify(Object.fromEntries(Object.entries(all).filter(([k]) => /folder/i.test(k)))).slice(0, 2000));
    throw err;
  }
}

/** Screenshot the screensaver showing the one photo in `folder` */
async function screensaver(name, folder, settings) {
  await set({panAndScan: false, showPhotog: true, showTime: TIME_12HR, ...settings});
  await useFolders([folder]);
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/screensaver.html`);
  await page.bringToFront();
  // a slide is on screen once it has `shown`, a size, and its fade-in is over
  const slides = () => page.evaluate(() => {
    const el = document.querySelector('screensaver-element');
    return [...el.shadowRoot.querySelectorAll('screensaver-slide')].map((s) => {
      const img = s.shadowRoot?.querySelector('img');
      const r = img?.getBoundingClientRect();
      return {shown: s.hasAttribute('shown'), opacity: getComputedStyle(s).opacity,
        loaded: !!img?.complete && img.naturalWidth > 0, w: Math.round(r?.width ?? 0), src: img?.src.split('/').pop()};
    });
  });
  try {
    await waitFor(async () => (await slides()).some((s) => s.shown && s.loaded && s.w > 0 && s.opacity === '1'), 20000);
  } catch (err) {
    console.log(JSON.stringify(await slides()));
    throw err;
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({path: join(STORE, 'screenshots', `${name}.png`)});
  await page.close();
  console.log(`wrote screenshots/${name}.png`);
}

/** Screenshot the Options page, optionally on a settings tab */
async function options(name, {tab = 1, dark = false} = {}) {
  await set({darkMode: dark});
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/options.html#settings`);
  const tabEl = await page.waitForSelector(`>>> settings-page >>> [role=tab]:nth-of-type(${tab})`, {timeout: 10000});
  await tabEl.click();
  await waitFor(() => page.evaluate((d) => (document.documentElement.dataset.theme === 'dark') === d, dark));
  await new Promise((r) => setTimeout(r, 500));
  // show a typical home folder instead of this machine's temp path
  await page.evaluate((from) => {
    const list = document.querySelector('options-app').shadowRoot.querySelector('settings-page')
        .shadowRoot.querySelector('folder-list')?.shadowRoot;
    for (const el of list?.querySelectorAll('.path') ?? []) {
      el.textContent = el.textContent.replace(from, '/home/me/Pictures');
    }
  }, tmp);
  await page.screenshot({path: join(STORE, 'screenshots', `${name}.png`)});
  await page.close();
  console.log(`wrote screenshots/${name}.png`);
}

/** Render an HTML promo tile at width×height */
async function tile(name, width, height, {photo, iconSize, titleSize, tagSize}) {
  const font = (w) => dataUri(join(ROOT, `node_modules/@fontsource/roboto/files/roboto-latin-${w}-normal.woff2`), 'font/woff2');
  const page = await browser.newPage();
  await page.setViewport({width, height});
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Roboto; font-weight: 300; src: url(${font(300)}) format('woff2'); }
    @font-face { font-family: Roboto; font-weight: 500; src: url(${font(500)}) format('woff2'); }
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    body {
      font-family: Roboto, sans-serif; color: #fff;
      background: linear-gradient(90deg, rgba(10,14,30,.85) 0%, rgba(10,14,30,.55) 50%, rgba(10,14,30,0) 85%),
        url(${dataUri(join(CACHE, photo), 'image/jpeg')}) center / cover;
      display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${Math.round(width * 0.07)}px; box-sizing: border-box;
    }
    img { width: ${iconSize}px; height: ${iconSize}px; margin-bottom: ${Math.round(iconSize / 3)}px; }
    h1 { font-weight: 500; font-size: ${titleSize}px; line-height: 1.1; margin: 0; max-width: 80%; text-wrap: balance;
      text-shadow: 0 2px 8px rgba(0,0,0,.4); }
    p { font-weight: 300; font-size: ${tagSize}px; margin: ${Math.round(tagSize * 0.6)}px 0 0; max-width: 65%;
      text-shadow: 0 1px 6px rgba(0,0,0,.5); }
  </style></head><body>
    <img src="${dataUri(join(ROOT, 'public/images/icon_128.png'), 'image/png')}" alt="">
    <h1>Local Photo Screen Saver</h1>
    <p>Your own photo folders, shown full screen when your computer is idle.</p>
  </body></html>`, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: join(STORE, `${name}.png`)});
  await page.close();
  console.log(`wrote ${name}.png`);
}

try {
  await screensaver('1-zoom', 'Northern Ireland', {photoSizing: VIEW.ZOOM});
  await screensaver('2-frame', 'Venezuela', {photoSizing: VIEW.FRAME});
  await useFolders(FOLDERS);
  // show the defaults, plus pan and zoom toward faces
  await set({photoSizing: VIEW.LETTERBOX, panAndScan: true, detectFaces: true});
  await options('3-settings');
  await options('4-photo-sources', {tab: 3});
  await options('5-dark', {dark: true});
  await tile('promo-small-440x280', 440, 280,
      {photo: 'Sweden/trommekilen-sunset.jpg', iconSize: 40, titleSize: 30, tagSize: 13});
  await tile('promo-marquee-1400x560', 1400, 560,
      {photo: 'Sweden/trommekilen-sunset.jpg', iconSize: 96, titleSize: 72, tagSize: 30});
} finally {
  await browser.close();
  rmSync(tmp, {recursive: true, force: true});
}
