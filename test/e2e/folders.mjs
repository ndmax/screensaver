/**
 * Browser test of local photo folders: the Options folder list, scanning in
 * the service worker, Chrome's file access switch and the screensaver.
 *
 * Run with `npm run test:e2e` (builds first). Screenshots go to test/e2e/out/.
 */

import {copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {assert, checker, launch, setFileAccess, waitFor} from './harness.mjs';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');
const OUT = resolve(import.meta.dirname, 'out');

// a temporary photo tree
const root = mkdtempSync(join(tmpdir(), 'ss-folders-'));
const TRIP = join(root, 'Trip');
const OTHER = join(root, 'Other #1');
mkdirSync(join(TRIP, 'Day 1'), {recursive: true});
mkdirSync(join(TRIP, '.hidden'));
mkdirSync(OTHER);
mkdirSync(OUT, {recursive: true});
copyFileSync(join(FIXTURES, 'wide.jpg'), join(TRIP, 'wide.jpg'));
copyFileSync(join(FIXTURES, 'rotated.jpg'), join(TRIP, 'Day 1', 'rotated.jpg'));
copyFileSync(join(FIXTURES, 'wide.jpg'), join(TRIP, '.hidden', 'hidden.jpg'));
writeFileSync(join(TRIP, 'clip.heic'), '');
writeFileSync(join(TRIP, 'wide.jpg.json'), '{}');
copyFileSync(join(FIXTURES, 'square.png'), join(OTHER, 'square.png'));
writeFileSync(join(root, 'notes.txt'), 'not a folder');

const {browser, extId, sw: firstSw} = await launch();
let sw = firstSw;
const {check, done} = checker();

/** Run in the folder-list's shadow root */
const FL = `document.querySelector('options-app').shadowRoot.querySelector('settings-page')
  .shadowRoot.querySelector('folder-list').shadowRoot`;

async function openOptions() {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/options.html#settings`);
  const tabs = await page.waitForSelector('>>> settings-page >>> [role=tab]:nth-of-type(3)', {timeout: 10000});
  await tabs.click();
  await page.waitForSelector('>>> folder-list >>> #path');
  return page;
}

const rows = (page) => page.evaluate(`[...${FL}.querySelectorAll('.folder')].map((r) => ({
  path: r.dataset.path, text: r.querySelector('.labels').innerText.replace(/\\s+/g, ' ').trim()}))`);
const addError = (page) => page.evaluate(`${FL}.querySelector('#addError').hidden ? '' : ${FL}.querySelector('#addError').textContent`);
const storage = (keys = null) => sw.evaluate((k) => chrome.storage.local.get(k), keys);

async function addPath(page, path) {
  const input = await page.$('>>> folder-list >>> #path');
  await input.evaluate((el) => (el.value = ''));
  await input.type(path);
  await input.press('Enter');
}

const rowFor = async (page, path) => (await rows(page)).find((r) => r.path === path);

try {
  let page = await openOptions();

  await check('empty list shows the hint and no file-access warning', async () => {
    const hint = await page.evaluate(`${FL}.querySelector('.hint')?.textContent ?? ''`);
    assert(hint.includes('Add a folder'), `hint: ${hint}`);
    assert(!await page.evaluate(`!!${FL}.querySelector('#fileAccess')`), 'warning shown');
  });

  await check('adding a folder scans it: 2 photos, 1 skipped', async () => {
    await addPath(page, TRIP);
    const row = await waitFor(async () => {
      const r = await rowFor(page, TRIP);
      return r?.text.includes('2 photos') && r;
    });
    assert(row.text.includes('1 skipped'), row.text);
    assert(await page.evaluate(`${FL}.querySelector('#path').value === ''`), 'input not cleared');
  });

  await check('stored photos have folder labels and the rotated aspect ratio', async () => {
    const photos = (await storage(`folder:${TRIP}`))[`folder:${TRIP}`];
    const byName = Object.fromEntries(photos.map((p) => [p.url.split('/').pop(), p]));
    assert(photos.length === 2, `photos: ${photos.length}`);
    assert(byName['rotated.jpg']?.asp === '0.500', `rotated asp ${byName['rotated.jpg']?.asp}`);
    assert(byName['rotated.jpg'].author === 'Day 1', `author ${byName['rotated.jpg'].author}`);
    assert(byName['wide.jpg'].asp === '2.00' && byName['wide.jpg'].author === 'Trip', JSON.stringify(byName['wide.jpg']));
    assert(byName['rotated.jpg'].url.startsWith('file:///') && byName['rotated.jpg'].url.includes('Day%201'), byName['rotated.jpg'].url);
  });

  await check('duplicate and overlapping paths are refused', async () => {
    await addPath(page, `${TRIP}/`);
    assert((await addError(page)).includes('Already in the list'), await addError(page));
    await addPath(page, join(TRIP, 'Day 1'));
    assert((await addError(page)).includes('Overlaps'), await addError(page));
    await addPath(page, root);
    assert((await addError(page)).includes('Overlaps'), await addError(page));
  });

  await check('missing paths and files are refused', async () => {
    await addPath(page, join(root, 'nope'));
    await waitFor(async () => (await addError(page)).includes('Folder not found'));
    await addPath(page, join(root, 'notes.txt'));
    await waitFor(async () => (await addError(page)).includes('Not a folder'));
    assert((await rows(page)).length === 1, 'a bad path was added');
  });

  await check('a path with # and a space works', async () => {
    await addPath(page, OTHER);
    await waitFor(async () => (await rowFor(page, OTHER))?.text.includes('1 photos'));
  });

  await check('removing a folder deletes its photos', async () => {
    await page.click(`>>> folder-list >>> .folder[data-path="${OTHER}"] .remove`);
    await waitFor(async () => !(await rowFor(page, OTHER)));
    await waitFor(async () => !Object.keys(await storage()).some((k) => k.includes('Other')));
    const {photoFolders} = await storage('photoFolders');
    assert(JSON.stringify(photoFolders) === JSON.stringify([TRIP]), JSON.stringify(photoFolders));
  });

  await check('a folder that disappears keeps its photos and shows an error', async () => {
    renameSync(TRIP, `${TRIP}-moved`);
    try {
      await sw.evaluate(() => chrome.alarms.create('UPDATE_PHOTOS', {when: Date.now() + 50}));
      await waitFor(async () => (await rowFor(page, TRIP))?.text.includes('Folder not found'));
      const photos = (await storage(`folder:${TRIP}`))[`folder:${TRIP}`];
      assert(photos.length === 2, `photos: ${photos.length}`);
      assert((await rowFor(page, TRIP)).text.includes('2 photos'), (await rowFor(page, TRIP)).text);
    } finally {
      renameSync(`${TRIP}-moved`, TRIP);
    }
    await sw.evaluate(() => chrome.alarms.create('UPDATE_PHOTOS', {when: Date.now() + 50}));
    await waitFor(async () => {
      const r = await rowFor(page, TRIP);
      return r && !r.text.includes('not found') && r.text.includes('2 photos');
    });
  });

  await check('screensaver preview shows a photo from the folder', async () => {
    await page.evaluate(() => chrome.runtime.sendMessage({message: 'showScreensaver'}));
    const target = await browser.waitForTarget((t) => t.url().includes('screensaver.html'), {timeout: 10000});
    const ss = await target.page();
    await waitFor(() => ss.evaluate(() => {
      const el = document.querySelector('screensaver-element');
      const imgs = [...el.shadowRoot.querySelectorAll('screensaver-slide')]
          .map((s) => s.shadowRoot?.querySelector('img')).filter(Boolean);
      return imgs.some((i) => i.src.startsWith('file:///') && i.complete && i.naturalWidth > 0);
    }));
    // the first slide fades in
    await ss.bringToFront();
    const shown = await waitFor(() => ss.evaluate(() => {
      const el = document.querySelector('screensaver-element');
      for (const slide of el.shadowRoot.querySelectorAll('screensaver-slide')) {
        const img = slide.shadowRoot?.querySelector('img');
        const r = img?.getBoundingClientRect();
        if (img?.src.startsWith('file:///') && getComputedStyle(slide).opacity === '1' && r && r.width > 0) {
          return {src: img.src.split('/').pop(), w: Math.round(r.width), h: Math.round(r.height)};
        }
      }
      return null;
    }), 15000);
    console.log(`  showing ${JSON.stringify(shown)}`);
    await ss.screenshot({path: join(OUT, 'screensaver.png')});
    await ss.close();
  });

  await check('restore defaults keeps the folder list', async () => {
    await page.evaluate(() => chrome.storage.local.set({showPhotog: false}));
    await page.evaluate(() => chrome.runtime.sendMessage({message: 'restoreDefaults'}));
    await waitFor(async () => (await storage('showPhotog')).showPhotog === true);
    const {photoFolders} = await storage('photoFolders');
    assert(JSON.stringify(photoFolders) === JSON.stringify([TRIP]), JSON.stringify(photoFolders));
  });

  await check('narrow window: no horizontal scroll', async () => {
    await page.setViewport({width: 400, height: 800});
    await addPath(page, join(root, 'a very long folder name that keeps going and going', 'and more'));
    await waitFor(async () => (await addError(page)).length > 0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 0, `overflow ${over}px`);
    await page.screenshot({path: join(OUT, 'folders-narrow.png'), fullPage: true});
    await page.setViewport({width: 1280, height: 900});
  });

  await check('light and dark screenshots', async () => {
    await page.bringToFront();
    await page.screenshot({path: join(OUT, 'folders-light.png')});
    await page.evaluate(() => chrome.storage.local.set({darkMode: true}));
    await waitFor(() => page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
    await page.screenshot({path: join(OUT, 'folders-dark.png')});
    await page.evaluate(() => chrome.storage.local.set({darkMode: false}));
  });

  await check('file access off: warning shown and adding is refused', async () => {
    await page.close().catch(() => {});
    sw = await setFileAccess(browser, extId, false) ?? sw;
    page = await openOptions();
    await page.waitForSelector('>>> folder-list >>> #fileAccess', {timeout: 5000});
    await page.click('>>> folder-list >>> #openExtSettings');
    const ext = await browser.waitForTarget((t) => t.url().startsWith(`chrome://extensions/?id=${extId}`), {timeout: 5000});
    await (await ext.page()).close();
    await addPath(page, OTHER);
    await waitFor(async () => (await addError(page)).includes('blocking file access'));
    await page.screenshot({path: join(OUT, 'folders-no-access.png')});
  });

  await check('file access back on: warning gone, folder still listed', async () => {
    await page.close().catch(() => {});
    sw = await setFileAccess(browser, extId, true) ?? sw;
    page = await openOptions();
    await waitFor(async () => (await rowFor(page, TRIP))?.text.includes('2 photos'));
    assert(!await page.evaluate(`!!${FL}.querySelector('#fileAccess')`), 'warning still shown');
  });
} finally {
  done();
  await browser.close();
  rmSync(root, {recursive: true, force: true});
}
