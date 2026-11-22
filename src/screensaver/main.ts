/**
 * Screensaver page entry point: settings, input handling, and messages.
 *
 * Ported from scripts/screensaver/screensaver.ts and ss_events.ts.
 */

import '@fontsource/roboto/latin-200.css';
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {DEBUG, errMsg} from '../lib/utils';
import * as FaceDetect from './face_detect';
import './screensaver-element';
import type {ScreensaverElement} from './screensaver-element';

/** Mouse movement (px, either axis) that counts as user activity */
const MOVE_THRESHOLD = 10;
/** Give other screensavers time to get our close message, ms */
const CLOSE_DELAY = 750;

let ss: ScreensaverElement;
let closing = false;

/** Close all the screensavers, starting with the others */
function close(): void {
  if (closing) {
    return;
  }
  closing = true;
  Msg.broadcast({message: 'closeScreensaver'});
  setTimeout(() => window.close(), CLOSE_DELAY);
}

const isStarted = (): boolean => ss?.slideshow?.isStarted() ?? false;
const isInteractive = (): boolean => ss?.slideshow?.isInteractive() ?? false;

function onKey(ev: KeyboardEvent): void {
  if (!isStarted() && !isInteractive()) {
    close();
    return;
  }
  switch (ev.key) {
    case 'Alt':
    case 'Shift':
    case ' ':
    case 'ArrowLeft':
    case 'ArrowRight':
      // parts of the interactive mode shortcuts
      if (!isInteractive()) {
        close();
      }
      break;
    default:
      close();
      break;
  }
}

let mouseStart: {x: number; y: number} | null = null;

function onMouseMove(ev: MouseEvent): void {
  if (!mouseStart) {
    mouseStart = {x: ev.clientX, y: ev.clientY};
    return;
  }
  const delta = Math.max(Math.abs(ev.clientX - mouseStart.x), Math.abs(ev.clientY - mouseStart.y));
  if (delta > MOVE_THRESHOLD) {
    close();
  }
}

function onClick(): void {
  if (isStarted() && Settings.get('allowPhotoClicks')) {
    ss.getSelectedPhoto()?.showSource();
  }
  close();
}

function onCommand(cmd: string): void {
  const show = ss?.slideshow;
  if (!show || !show.isStarted() || !show.isInteractive()) {
    return;
  }
  if (cmd === 'ss-toggle-paused') {
    show.togglePaused();
  } else if (cmd === 'ss-forward') {
    show.forward();
  } else if (cmd === 'ss-back') {
    show.back();
  }
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
window.addEventListener('keydown', onKey);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);
chrome.commands.onCommand.addListener(onCommand);

/** Undo any browser zoom on this page */
async function resetZoom(): Promise<void> {
  try {
    const zoom = await chrome.tabs.getZoom();
    if (zoom <= 0.99 || zoom >= 1.01) {
      await chrome.tabs.setZoom(1.0);
    }
  } catch (err) {
    Log.warn(errMsg(err), 'SS.resetZoom');
  }
}

async function main(): Promise<void> {
  await Settings.ready();
  // the setting is a full declaration: 'background:<value>'
  document.body.style.background = Settings.get('background').replace(/^background:/, '');
  await resetZoom();
  ss = document.querySelector('screensaver-element')!;
  await ss.launch();
}

if (DEBUG) {
  // hooks for end-to-end tests of a development build
  Object.assign(window, {ssDebug: {FaceDetect, get ss() {
    return ss;
  }}});
}

main().catch((err: unknown) => {
  Log.error(errMsg(err), 'SS.main');
  close();
});
