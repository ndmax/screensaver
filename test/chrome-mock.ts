/**
 * Minimal in-memory `chrome` global for unit tests: storage.local (with
 * onChanged), i18n and runtime messaging.
 */

import {beforeEach, vi} from 'vitest';

type Changes = Record<string, chrome.storage.StorageChange>;
type ChangeListener = (changes: Changes, area: string) => void;

const store = new Map<string, unknown>();
const changeListeners = new Set<ChangeListener>();
const messages: Record<string, string> = {};

function emit(changes: Changes): void {
  if (!Object.keys(changes).length) {
    return;
  }
  // chrome.storage.onChanged is delivered asynchronously
  queueMicrotask(() => {
    for (const l of changeListeners) {
      l(changes, 'local');
    }
  });
}

function keysOf(keys?: string | string[] | Record<string, unknown> | null): string[] {
  if (keys == null) {
    return [...store.keys()];
  }
  if (typeof keys === 'string') {
    return [keys];
  }
  return Array.isArray(keys) ? keys : Object.keys(keys);
}

const local = {
  get: vi.fn(async (keys?: string | string[] | null) => {
    const out: Record<string, unknown> = {};
    for (const k of keysOf(keys)) {
      if (store.has(k)) {
        out[k] = structuredClone(store.get(k));
      }
    }
    return out;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    const changes: Changes = {};
    for (const [k, v] of Object.entries(items)) {
      const old = store.get(k);
      if (JSON.stringify(old) !== JSON.stringify(v)) {
        changes[k] = {oldValue: old, newValue: structuredClone(v)};
      }
      store.set(k, structuredClone(v));
    }
    emit(changes);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const changes: Changes = {};
    for (const k of keysOf(keys)) {
      if (store.has(k)) {
        changes[k] = {oldValue: store.get(k)};
        store.delete(k);
      }
    }
    emit(changes);
  }),
};

export const chromeMock = {
  storage: {
    local,
    onChanged: {
      addListener: (l: ChangeListener) => changeListeners.add(l),
      removeListener: (l: ChangeListener) => changeListeners.delete(l),
    },
  },
  i18n: {
    getMessage: (key: string) => messages[key] ?? '',
  },
  runtime: {
    sendMessage: vi.fn(async () => {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    }),
    onMessage: {addListener: vi.fn(), removeListener: vi.fn()},
    getManifest: () => ({version: '0.0.0-test'}),
  },
};

/** Directly seed storage without firing onChanged */
export function seedStorage(items: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(items)) {
    store.set(k, structuredClone(v));
  }
}

export function setMessages(msgs: Record<string, string>): void {
  Object.assign(messages, msgs);
}

/** Let queued onChanged events deliver */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

(globalThis as unknown as {chrome: typeof chromeMock}).chrome = chromeMock;

beforeEach(() => {
  store.clear();
  for (const k of Object.keys(messages)) {
    delete messages[k];
  }
});
