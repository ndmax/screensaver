import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as Settings from '../src/lib/settings';
import {chromeMock, flush, seedStorage} from './chrome-mock';

beforeEach(() => {
  Settings._resetForTests();
});

describe('Settings', () => {
  it('throws if get() is called before ready()', () => {
    expect(() => Settings.get('enabled')).toThrow(/before Settings.ready/);
  });

  it('returns defaults when storage is empty', async () => {
    await Settings.ready();
    expect(Settings.get('enabled')).toBe(true);
    expect(Settings.get('idleTime')).toEqual({base: 5, display: 5, unit: 0});
  });

  it('returns stored values over defaults', async () => {
    seedStorage({enabled: false, activeStart: '08:30'});
    await Settings.ready();
    expect(Settings.get('enabled')).toBe(false);
    expect(Settings.get('activeStart')).toBe('08:30');
  });

  it('set() updates the cache immediately and persists', async () => {
    await Settings.ready();
    await Settings.set('shuffle', false);
    expect(Settings.get('shuffle')).toBe(false);
    expect((await chromeMock.storage.local.get('shuffle')).shuffle).toBe(false);
  });

  it('picks up changes made by other contexts and notifies subscribers', async () => {
    await Settings.ready();
    const listener = vi.fn();
    Settings.subscribe(listener);
    // simulate another context writing directly to storage
    await chromeMock.storage.local.set({darkMode: true, unrelatedKey: 1});
    await flush();
    expect(Settings.get('darkMode')).toBe(true);
    expect(listener).toHaveBeenCalledWith(['darkMode']);
  });

  it('reverts to the default when a setting is removed from storage', async () => {
    seedStorage({skip: false});
    await Settings.ready();
    await chromeMock.storage.local.remove('skip');
    await flush();
    expect(Settings.get('skip')).toBe(true);
  });

  it('unsubscribe stops notifications', async () => {
    await Settings.ready();
    const listener = vi.fn();
    const unsubscribe = Settings.subscribe(listener);
    unsubscribe();
    await Settings.set('largeTime', true);
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('addDefaults() writes only missing keys', async () => {
    seedStorage({enabled: false});
    await Settings.addDefaults();
    const stored = await chromeMock.storage.local.get(null);
    expect(stored.enabled).toBe(false);
    expect(stored.keepAwake).toBe(false);
    expect(Object.keys(stored).sort()).toEqual([...Settings.KEYS].sort());
  });

  it('a change that lands during the initial load is not overwritten', async () => {
    seedStorage({allDisplays: false});
    // hold the initial get() until after a change event arrives
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realGet = chromeMock.storage.local.get.getMockImplementation()!;
    chromeMock.storage.local.get.mockImplementationOnce(async (keys) => {
      const result = await realGet(keys);
      await gate;
      return result;
    });
    const loading = Settings.ready();
    await chromeMock.storage.local.set({allDisplays: true});
    await flush();
    release();
    await loading;
    expect(Settings.get('allDisplays')).toBe(true);
  });

  it('isSettingKey', () => {
    expect(Settings.isSettingKey('enabled')).toBe(true);
    expect(Settings.isSettingKey('lastError')).toBe(false);
    expect(Settings.isSettingKey('toString')).toBe(false);
  });
});
