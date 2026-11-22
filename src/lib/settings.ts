/**
 * User settings, persisted in chrome.storage.local.
 *
 * Replaces the original synchronous localStorage design (ChromeStorage.get/set,
 * <app-localstorage-document>, and window 'storage' events), none of which
 * exist in an MV3 service worker.
 *
 * Usage:
 *   await Settings.ready();         // once per context, before any get()
 *   Settings.get('enabled');        // synchronous, from an in-memory cache
 *   await Settings.set('enabled', false);
 *   Settings.subscribe((keys) => ...);  // fires in every context, including the writer
 *
 * The cache is kept current from chrome.storage.onChanged, so a write in any
 * extension context (options page, service worker, screensaver) is seen by all.
 */

import {DEF_TIME, TIME_FORMAT, type TimeFormat} from './time';

/** Slide transition animation */
export const TRANS_TYPE = {
  SCALE_UP: 0,
  FADE: 1,
  SLIDE_FROM_RIGHT: 2,
  SLIDE_DOWN: 3,
  SPIN_UP: 4,
  SLIDE_UP: 5,
  SLIDE_FROM_BOTTOM: 6,
  SLIDE_RIGHT: 7,
  RANDOM: 8,
} as const;
export type TransType = (typeof TRANS_TYPE)[keyof typeof TRANS_TYPE];

/** Photo sizing */
export const VIEW_TYPE = {
  LETTERBOX: 0,
  ZOOM: 1,
  FRAME: 2,
  FULL: 3,
  RANDOM: 4,
} as const;
export type ViewType = (typeof VIEW_TYPE)[keyof typeof VIEW_TYPE];

/**
 * A slider value with a selectable unit.
 * `base` is always in the setting's base unit (minutes for idleTime,
 * seconds for transitionTime); `display` and `unit` are UI state.
 */
export interface UnitValue {
  base: number;
  display: number;
  unit: number;
}

export interface Settings {
  /** Screensaver enabled */
  enabled: boolean;
  /** Run Chrome in background (holds the optional "background" permission) */
  allowBackground: boolean;
  /** Idle time before display (base: minutes) */
  idleTime: UnitValue;
  /** Time between photos (base: seconds) */
  transitionTime: UnitValue;
  /** Skip photos with extreme aspect ratios */
  skip: boolean;
  /** Show photos in random order */
  shuffle: boolean;
  photoSizing: ViewType;
  photoTransition: TransType;
  /** Manual control of the screensaver */
  interactive: boolean;
  /** Show the photo's folder name */
  showPhotog: boolean;
  /** CSS background for the screensaver */
  background: string;
  /** Don't display over fullscreen Chrome windows */
  chromeFullscreen: boolean;
  /** Show on all displays */
  allDisplays: boolean;
  largeTime: boolean;
  showTime: TimeFormat;
  /** Prevent the display from sleeping */
  keepAwake: boolean;
  /** Start of the active period, 'HH:MM' */
  activeStart: string;
  /** End of the active period, 'HH:MM' */
  activeStop: string;
  /** Allow the computer to sleep outside the active period */
  allowSuspend: boolean;
  /** Left click opens the photo's source page */
  allowPhotoClicks: boolean;
  /** Local folder paths to show photos from, as the user entered them */
  photoFolders: string[];
  /** "Ken Burns" effect */
  panAndScan: boolean;
  /** Pan to faces during pan and scan */
  detectFaces: boolean;
  /** Dark theme for the options UI */
  darkMode: boolean;
}

export type SettingKey = keyof Settings;

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  enabled: true,
  allowBackground: false,
  idleTime: {base: 5, display: 5, unit: 0},
  transitionTime: {base: 30, display: 30, unit: 0},
  skip: true,
  shuffle: true,
  photoSizing: VIEW_TYPE.LETTERBOX,
  photoTransition: TRANS_TYPE.FADE,
  interactive: false,
  showPhotog: true,
  background: 'background:linear-gradient(to bottom, #3a3a3a, #b5bdc8)',
  chromeFullscreen: true,
  allDisplays: false,
  largeTime: false,
  showTime: TIME_FORMAT.HR_24,
  keepAwake: false,
  activeStart: DEF_TIME,
  activeStop: DEF_TIME,
  allowSuspend: false,
  allowPhotoClicks: true,
  photoFolders: [],
  panAndScan: false,
  detectFaces: false,
  darkMode: false,
});

export const KEYS = Object.keys(DEFAULTS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(DEFAULTS, key);
}

export type Listener = (keys: SettingKey[]) => void;

const cache: Settings = structuredClone(DEFAULTS);
const listeners = new Set<Listener>();
/** Keys changed by onChanged while the initial load was in flight */
const changedDuringLoad = new Set<SettingKey>();
let loading: Promise<void> | null = null;
let loaded = false;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }
  const keys: SettingKey[] = [];
  for (const [key, change] of Object.entries(changes)) {
    if (!isSettingKey(key)) {
      continue;
    }
    const value = change.newValue === undefined ? DEFAULTS[key] : change.newValue;
    (cache as unknown as Record<string, unknown>)[key] = structuredClone(value);
    if (!loaded) {
      changedDuringLoad.add(key);
    }
    keys.push(key);
  }
  if (keys.length) {
    for (const listener of listeners) {
      try {
        listener(keys);
      } catch (err) {
        console.error('Settings listener failed', err);
      }
    }
  }
});

/** Load settings from storage. Safe to call repeatedly. */
export function ready(): Promise<void> {
  loading ??= chrome.storage.local.get(KEYS).then((stored) => {
    for (const key of KEYS) {
      if (key in stored && !changedDuringLoad.has(key)) {
        (cache as unknown as Record<string, unknown>)[key] = stored[key];
      }
    }
    changedDuringLoad.clear();
    loaded = true;
  });
  return loading;
}

/** Get a setting. Call (and await) ready() first in each context. */
export function get<K extends SettingKey>(key: K): Settings[K] {
  if (!loaded) {
    throw new Error(`Settings.get('${key}') called before Settings.ready()`);
  }
  return cache[key];
}

/** Get a snapshot of all settings. */
export function getAll(): Settings {
  if (!loaded) {
    throw new Error('Settings.getAll() called before Settings.ready()');
  }
  return structuredClone(cache);
}

/** Persist a setting. Listeners fire via chrome.storage.onChanged. */
export async function set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  cache[key] = value;
  await chrome.storage.local.set({[key]: value});
}

/** Persist several settings at once. */
export async function setMany(values: Partial<Settings>): Promise<void> {
  Object.assign(cache, values);
  await chrome.storage.local.set(values);
}

/** Write the default for every setting not already in storage. */
export async function addDefaults(): Promise<void> {
  const stored = await chrome.storage.local.get(KEYS);
  const missing: Partial<Record<SettingKey, unknown>> = {};
  for (const key of KEYS) {
    if (!(key in stored)) {
      missing[key] = DEFAULTS[key];
    }
  }
  if (Object.keys(missing).length) {
    await chrome.storage.local.set(missing);
  }
}

/**
 * Subscribe to setting changes from any extension context.
 *
 * @returns a function that unsubscribes
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: reset module state. */
export function _resetForTests(): void {
  Object.assign(cache, structuredClone(DEFAULTS));
  listeners.clear();
  changedDuringLoad.clear();
  loading = null;
  loaded = false;
}
