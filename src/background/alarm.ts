/**
 * chrome.alarms scheduling.
 *
 * Ported from scripts/background/alarm.ts. The weather alarm is gone.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Settings from '../lib/settings';
import {getTimeDelta, isInRange, MIN_IN_DAY, MSEC_IN_DAY} from '../lib/time';
import {errMsg} from '../lib/utils';
import * as SSController from './ss_controller';

export const ALARMS = {
  /** Entering the keep awake active period */
  ACTIVATE: 'ACTIVATE',
  /** Leaving the keep awake active period */
  DEACTIVATE: 'DEACTIVATE',
  /** Daily photo source refresh */
  UPDATE_PHOTOS: 'UPDATE_PHOTOS',
  /** Update the icon badge */
  BADGE_TEXT: 'BADGE_TEXT',
} as const;

/** Create or clear the daily keep awake alarms */
export async function updateKeepAwakeAlarm(): Promise<void> {
  const keepAwake = Settings.get('keepAwake');
  const aStart = Settings.get('activeStart');
  const aStop = Settings.get('activeStop');

  if (keepAwake && aStart !== aStop) {
    await chrome.alarms.create(ALARMS.ACTIVATE, {
      delayInMinutes: getTimeDelta(aStart),
      periodInMinutes: MIN_IN_DAY,
    });
    await chrome.alarms.create(ALARMS.DEACTIVATE, {
      delayInMinutes: getTimeDelta(aStop),
      periodInMinutes: MIN_IN_DAY,
    });
    if (!isInRange(aStart, aStop)) {
      setInactiveState();
    }
  } else {
    await chrome.alarms.clear(ALARMS.ACTIVATE);
    await chrome.alarms.clear(ALARMS.DEACTIVATE);
  }

  await updateBadgeTextAlarm();
}

/** Create the daily photo refresh alarm, if needed */
export async function updatePhotoAlarm(): Promise<void> {
  const alarm = await chrome.alarms.get(ALARMS.UPDATE_PHOTOS);
  if (!alarm) {
    await chrome.alarms.create(ALARMS.UPDATE_PHOTOS, {
      when: Date.now() + MSEC_IN_DAY,
      periodInMinutes: MIN_IN_DAY,
    });
  }
}

/** Update the badge shortly, after any time range checks settle */
export async function updateBadgeTextAlarm(): Promise<void> {
  await chrome.alarms.create(ALARMS.BADGE_TEXT, {when: Date.now() + 1000});
}

async function setActiveState(): Promise<void> {
  if (Settings.get('keepAwake')) {
    chrome.power.requestKeepAwake('display');
  }
  const state = await chrome.idle.queryState(SSController.getIdleSeconds());
  if (Settings.get('enabled') && state === 'idle') {
    await SSController.display(false);
  }
  await updateBadgeTextAlarm();
}

function setInactiveState(): void {
  if (Settings.get('allowSuspend')) {
    chrome.power.releaseKeepAwake();
  } else {
    chrome.power.requestKeepAwake('system');
  }
  SSController.close();
}

async function setBadgeText(): Promise<void> {
  let text: string;
  if (Settings.get('enabled')) {
    text = SSController.isActive() ? '' : localize('sleep_abbrev');
  } else {
    text = Settings.get('keepAwake') ? localize('power_abbrev') : localize('off_abbrev');
  }
  await chrome.action.setBadgeText({text});
}

/** chrome.alarms.onAlarm handler */
export async function onAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  try {
    switch (alarm.name) {
      case ALARMS.ACTIVATE:
        await setActiveState();
        break;
      case ALARMS.DEACTIVATE:
        setInactiveState();
        await updateBadgeTextAlarm();
        break;
      case ALARMS.UPDATE_PHOTOS:
        // TODO(task 3): rescan folders
        break;
      case ALARMS.BADGE_TEXT:
        await setBadgeText();
        break;
      default:
        break;
    }
  } catch (err) {
    Log.error(errMsg(err), `Alarm.onAlarm(${alarm.name})`);
  }
}
