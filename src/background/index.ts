/**
 * Service worker entry point.
 *
 * MV3 service workers are stopped when idle and restarted for each event, so:
 * - every listener is registered synchronously at top level, and
 * - every handler awaits Settings.ready() before reading settings.
 */

import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {errMsg} from '../lib/utils';
import * as Alarm from './alarm';
import * as ContextMenus from './context_menus';
import * as Data from './data';
import * as SSController from './ss_controller';

/** Wrap a handler so it runs after settings load, with errors logged. */
function withSettings<A extends unknown[]>(name: string, fn: (...args: A) => Promise<void> | void) {
  return async (...args: A): Promise<void> => {
    try {
      await Settings.ready();
      await fn(...args);
    } catch (err) {
      Log.error(errMsg(err), name);
    }
  };
}

chrome.runtime.onInstalled.addListener(withSettings('onInstalled',
    async (details: chrome.runtime.InstalledDetails) => {
      if (details.reason === 'install') {
        await Data.initialize();
        await ContextMenus.initialize();
        await chrome.runtime.openOptionsPage();
      } else if (details.reason === 'update') {
        await Data.update();
        await ContextMenus.initialize();
      }
    }));

chrome.runtime.onStartup.addListener(withSettings('onStartup', () => Data.processState('all')));

chrome.action.onClicked.addListener(withSettings('onIconClicked', () => chrome.runtime.openOptionsPage()));

chrome.alarms.onAlarm.addListener(withSettings('onAlarm', Alarm.onAlarm));

chrome.idle.onStateChanged.addListener(withSettings('onIdleStateChanged', SSController.onIdleStateChanged));

chrome.contextMenus.onClicked.addListener(withSettings('onMenuClicked', ContextMenus.onMenuClicked));

chrome.commands.onCommand.addListener(withSettings('onCommand', ContextMenus.onCommand));

Settings.subscribe((keys) => {
  void (async () => {
    await Settings.ready();
    for (const key of keys) {
      await Data.processState(key);
    }
  })();
});

Msg.listen((msg) => {
  switch (msg.message) {
    case 'restoreDefaults':
      return Settings.ready().then(Data.restoreDefaults).then(() => ({message: 'OK'}));
    case 'showScreensaver':
      return Settings.ready().then(() => SSController.display()).then(() => ({message: 'OK'}));
    default:
      return undefined;
  }
});
