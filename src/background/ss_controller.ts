/**
 * Open and close the screensaver windows.
 *
 * Ported from scripts/background/ss_controller.ts.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {isInRange} from '../lib/time';
import {errMsg, isWindows} from '../lib/utils';

const SS_URL = 'screensaver.html';

/** Idle time before display, in seconds */
export function getIdleSeconds(): number {
  return Settings.get('idleTime').base * 60;
}

/**
 * Can the screensaver be displayed now: enabled, and either keep awake is
 * off or we are inside its active period.
 */
export function isActive(): boolean {
  const enabled = Settings.get('enabled');
  const keepAwake = Settings.get('keepAwake');
  const inRange = isInRange(Settings.get('activeStart'), Settings.get('activeStop'));
  return enabled && (!keepAwake || inRange);
}

/**
 * Display the screensaver(s). Always show the screensaver through this call.
 *
 * @param single - only show on the main display
 */
export async function display(single: boolean): Promise<void> {
  try {
    if (!single && Settings.get('allDisplays')) {
      await openOnAllDisplays();
    } else {
      await open();
    }
  } catch (err) {
    Log.error(errMsg(err), 'SSController.display');
  }
}

/** Ask all screensaver windows to close themselves */
export function close(): void {
  Msg.broadcast({message: 'closeScreensaver'});
}

/** Is a screensaver window open */
export async function isShowing(): Promise<boolean> {
  try {
    await Msg.send({message: 'isScreensaverShowing'});
    return true;
  } catch {
    return false;
  }
}

/**
 * Is there a fullscreen Chrome window on the display (or anywhere, if no
 * display is given). Only checked if the user asked us not to cover them.
 */
async function hasFullscreen(disp?: chrome.system.display.DisplayUnitInfo): Promise<boolean> {
  if (!Settings.get('chromeFullscreen')) {
    return false;
  }
  try {
    const wins = await chrome.windows.getAll({populate: false});
    const left = disp?.bounds.left ?? 0;
    const top = disp?.bounds.top ?? 0;
    return wins.some((win) =>
      win.state === 'fullscreen' && (!disp || (win.top === top && win.left === left)));
  } catch (err) {
    Log.warn(errMsg(err), 'SSController.hasFullscreen');
    return false;
  }
}

/**
 * Open a screensaver window.
 *
 * @param disp - a display, otherwise the main display
 */
async function open(disp?: chrome.system.display.DisplayUnitInfo): Promise<void> {
  try {
    if (await hasFullscreen(disp)) {
      return;
    }
    const opts: chrome.windows.CreateData = {url: SS_URL, type: 'popup'};
    if (disp) {
      opts.left = disp.bounds.left;
      opts.top = disp.bounds.top;
      opts.width = disp.bounds.width;
      opts.height = disp.bounds.height;
    } else {
      opts.state = 'fullscreen';
    }
    const win = await chrome.windows.create(opts);
    if (win?.id !== undefined) {
      if (disp) {
        await chrome.windows.update(win.id, {state: 'fullscreen'});
      }
      await chrome.windows.update(win.id, {focused: true});
    }
  } catch (err) {
    Log.error(errMsg(err), 'SSController.open', localize('err_show_ss'));
  }
}

async function openOnAllDisplays(): Promise<void> {
  const displays = await chrome.system.display.getInfo();
  if (displays.length === 1) {
    await open();
  } else {
    for (const disp of displays) {
      await open(disp);
    }
  }
}

/**
 * chrome.idle.onStateChanged handler.
 * 'idle': no input for the detection interval; 'locked': screen locked or
 * the OS screensaver started; 'active': user input on an idle system.
 */
export async function onIdleStateChanged(state: `${chrome.idle.IdleState}`): Promise<void> {
  try {
    if (state === 'idle') {
      if (isActive() && !(await isShowing())) {
        await display(false);
      }
    } else if (state === 'locked') {
      close();
    } else if (!(await isWindows())) {
      // Windows reports 'active' when our window is created, so the
      // screensaver page closes itself on input there instead.
      close();
    }
  } catch (err) {
    Log.warn(errMsg(err), 'SSController.onIdleStateChanged');
  }
}
