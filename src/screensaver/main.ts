/**
 * TEMPORARY screensaver page: shows one random photo and handles the
 * service worker's close / is-showing messages. The real slideshow
 * (screensaver-element, screensaver-slide, ss_* modules) is ported in step 3.
 */

import {localize} from '../lib/locale';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import * as PhotoSources from '../sources/photo_sources';

/** Mouse movement (px) that counts as user activity */
const MOVE_THRESHOLD = 10;

function close(): void {
  window.close();
}

Msg.listen((msg) => {
  switch (msg.message) {
    case 'isScreensaverShowing':
      return {message: 'OK'};
    case 'closeScreensaver':
      close();
      return undefined;
    default:
      return undefined;
  }
});

window.addEventListener('keydown', close);
window.addEventListener('mousedown', close);
let start: {x: number; y: number} | null = null;
window.addEventListener('mousemove', (ev) => {
  start ??= {x: ev.clientX, y: ev.clientY};
  if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > MOVE_THRESHOLD) {
    close();
  }
});

async function show(): Promise<void> {
  await Settings.ready();
  const all = [];
  for (const source of PhotoSources.getSelectedSources()) {
    all.push(...(await source.getPhotos()).photos);
  }
  const msgEl = document.getElementById('msg')!;
  if (!all.length) {
    msgEl.textContent = localize('no_photos');
    return;
  }
  const photo = all[Math.floor(Math.random() * all.length)];
  (document.getElementById('photo') as HTMLImageElement).src = photo.url;
  document.getElementById('author')!.textContent = photo.author;
}

void show();
