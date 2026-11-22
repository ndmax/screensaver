/**
 * Install, update and settings-change processing.
 *
 * Ported from scripts/background/data.ts. The DEFS object moved to
 * lib/settings.ts. The v1-v29 localStorage migrations are dropped: a rebuilt
 * extension has a new extension ID, so it cannot see the old extension's data.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Settings from '../lib/settings';
import type {SettingKey} from '../lib/settings';
import {TIME_FORMAT, type TimeFormat} from '../lib/time';
import {errMsg} from '../lib/utils';
import * as Alarm from './alarm';
import * as ContextMenus from './context_menus';
import * as SSController from './ss_controller';

/** Version of the stored data. Bump and add a migration when it changes. */
export const DATA_VERSION = 2;
const VERSION_KEY = 'dataVersion';

/**
 * Settings that restoreDefaults leaves alone: permBackground mirrors Chrome's
 * grant, and the folder list is the user's content, not a preference.
 */
const KEEP_ON_RESTORE: readonly SettingKey[] = ['permBackground', 'photoFolders'];

/** Keys of the removed Unsplash source and face detection permission (v1) */
const V1_REMOVED_KEYS = [
  'useArchitectureUnsplash', 'useNatureUnsplash', 'usePeopleUnsplash', 'useCityUnsplash',
  'architectureUnsplashImages', 'natureUnsplashImages', 'peopleUnsplashImages', 'cityUnsplashImages',
  'permDetectFaces',
];

/** First install */
export async function initialize(): Promise<void> {
  await chrome.storage.local.set({[VERSION_KEY]: DATA_VERSION});
  await Settings.addDefaults();
  await Settings.set('showTime', getTimeFormat());
  await Log.resetLastError();
  await processState('all');
}

/** Extension updated */
export async function update(): Promise<void> {
  const res = await chrome.storage.local.get(VERSION_KEY);
  const oldVersion = (res[VERSION_KEY] as number | undefined) ?? 0;
  if (oldVersion < DATA_VERSION) {
    await migrate(oldVersion);
    await chrome.storage.local.set({[VERSION_KEY]: DATA_VERSION});
  }
  await Settings.addDefaults();
  await processState('all');
}

/**
 * Migrate stored data from an older DATA_VERSION.
 */
async function migrate(oldVersion: number): Promise<void> {
  if (oldVersion < 2) {
    await chrome.storage.local.remove(V1_REMOVED_KEYS);
  }
}

/**
 * Restore default settings. The resulting storage changes trigger
 * processState for each changed key.
 */
export async function restoreDefaults(): Promise<void> {
  const values: Partial<Record<SettingKey, unknown>> = {};
  for (const key of Settings.KEYS) {
    if (!KEEP_ON_RESTORE.includes(key)) {
      values[key] = structuredClone(Settings.DEFAULTS[key]);
    }
  }
  values.showTime = getTimeFormat();
  await Settings.setMany(values as Partial<Settings.Settings>);
}

/**
 * Apply side effects for changed settings.
 *
 * @param key - the setting that changed, or 'all'
 */
export async function processState(key: SettingKey | 'all' = 'all'): Promise<void> {
  try {
    if (key === 'all') {
      await processEnabled();
      await processKeepAwake();
      processIdleTime();
      await Alarm.updatePhotoAlarm();
      return;
    }

    switch (key) {
      case 'enabled':
        await processEnabled();
        break;
      case 'idleTime':
        processIdleTime();
        break;
      case 'keepAwake':
      case 'activeStart':
      case 'activeStop':
      case 'allowSuspend':
        await processKeepAwake();
        break;
      default:
        break;
    }
  } catch (err) {
    Log.error(errMsg(err), `Data.processState(${key})`);
  }
}

/**
 * Enabled state changed. Does not affect keep awake, so the extension can be
 * used as a keep awake scheduler without the screensaver.
 */
async function processEnabled(): Promise<void> {
  await Alarm.updateBadgeTextAlarm();
  await ContextMenus.updateEnableTitle();
}

async function processKeepAwake(): Promise<void> {
  if (Settings.get('keepAwake')) {
    chrome.power.requestKeepAwake('display');
  } else {
    chrome.power.releaseKeepAwake();
  }
  await Alarm.updateKeepAwakeAlarm();
}

function processIdleTime(): void {
  chrome.idle.setDetectionInterval(SSController.getIdleSeconds());
}

/** Default clock format for the UI locale */
function getTimeFormat(): TimeFormat {
  return localize('time_format', '12') === '12' ? TIME_FORMAT.HR_12 : TIME_FORMAT.HR_24;
}
