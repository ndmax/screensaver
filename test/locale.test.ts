/**
 * Keep messages.json in step with the code: every message is used, and every
 * localize() key has a message.
 *
 * Every key is written out as a literal localize('key') call (or as
 * __MSG_key__ in the manifest), so the code can be searched for it. A key
 * that only appears as some other string, say a setting value that happens
 * to match, doesn't count as used.
 */

import {describe, expect, it} from 'vitest';
import messagesJson from '../public/_locales/en_US/messages.json';
import manifest from '../public/manifest.json?raw';

const messages = messagesJson as Record<string, unknown>;
const files = import.meta.glob<string>(['../src/**/*.{ts,html}', '!../src/lib/locale.ts'],
    {query: '?raw', import: 'default', eager: true});
const code = Object.values(files).join('\n');
const LITERAL_CALL = /\blocalize\('([a-z0-9_]+)'/g;
const used = new Set([
  ...[...code.matchAll(LITERAL_CALL)].map((m) => m[1]),
  ...[...manifest.matchAll(/__MSG_([a-z0-9_]+)__/g)].map((m) => m[1]),
]);

describe('locale messages', () => {
  it('reads the source', () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
  });

  it('every localize() call has a literal key', () => {
    const calls = [...code.matchAll(/\blocalize\(/g)].length;
    expect(calls).toBeGreaterThan(50);
    expect([...code.matchAll(LITERAL_CALL)].length).toBe(calls);
  });

  it('every message is used', () => {
    expect(Object.keys(messages).filter((key) => !used.has(key))).toEqual([]);
  });

  it('every key used has a message', () => {
    expect([...used].filter((key) => !(key in messages))).toEqual([]);
  });
});
