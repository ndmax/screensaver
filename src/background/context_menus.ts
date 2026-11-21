/**
 * Toolbar icon context menu and keyboard commands.
 *
 * Ported from scripts/background/context_menus.ts.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Settings from '../lib/settings';
import {errMsg} from '../lib/utils';
import * as SSController from './ss_controller';

const MENU = {
  DISPLAY: 'DISPLAY_MENU',
  ENABLE: 'ENABLE_MENU',
  SEP: 'SEP_MENU',
} as const;

function enableTitle(): string {
  return Settings.get('enabled') ? localize('disable') : localize('enable');
}

/** Create the menus. Menus persist, so call from runtime.onInstalled. */
export async function initialize(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    type: 'normal', id: MENU.DISPLAY, title: localize('display_now'), contexts: ['action'],
  });
  chrome.contextMenus.create({
    type: 'normal', id: MENU.ENABLE, title: enableTitle(), contexts: ['action'],
  });
  chrome.contextMenus.create({type: 'separator', id: MENU.SEP, contexts: ['action']});
}

/** Sync the enable/disable menu text with the setting */
export async function updateEnableTitle(): Promise<void> {
  try {
    await chrome.contextMenus.update(MENU.ENABLE, {title: enableTitle()});
  } catch {
    // not created yet
  }
}

/** Toggle the enabled state. Side effects run from the settings change. */
async function toggleEnabled(): Promise<void> {
  await Settings.set('enabled', !Settings.get('enabled'));
}

/** chrome.contextMenus.onClicked handler */
export async function onMenuClicked(info: chrome.contextMenus.OnClickData): Promise<void> {
  try {
    if (info.menuItemId === MENU.DISPLAY) {
      await SSController.display(false);
    } else if (info.menuItemId === MENU.ENABLE) {
      await toggleEnabled();
    }
  } catch (err) {
    Log.error(errMsg(err), 'ContextMenus.onMenuClicked');
  }
}

/**
 * chrome.commands.onCommand handler. The ss-* commands are handled by the
 * screensaver page.
 */
export async function onCommand(cmd: string): Promise<void> {
  try {
    if (cmd === 'toggle-enabled') {
      await toggleEnabled();
    } else if (cmd === 'show-screensaver') {
      await SSController.display(false);
    }
  } catch (err) {
    Log.error(errMsg(err), 'ContextMenus.onCommand');
  }
}
