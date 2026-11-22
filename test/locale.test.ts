/**
 * Keep messages.json in step with the code: every message is used, and every
 * literal localize('key') has a message.
 */

import {describe, expect, it} from 'vitest';
import messagesJson from '../public/_locales/en_US/messages.json';
import manifest from '../public/manifest.json?raw';

const messages = messagesJson as Record<string, unknown>;
const files = import.meta.glob<string>('../src/**/*.{ts,html}', {query: '?raw', import: 'default', eager: true});
const code = [...Object.values(files), manifest].join('\n');

describe('locale messages', () => {
  it('every message is referenced', () => {
    const unused = Object.keys(messages).filter((key) =>
      !code.includes(`'${key}'`) && !code.includes(`"${key}"`) && !code.includes(`__MSG_${key}__`));
    expect(unused).toEqual([]);
  });

  it('every literal localize() key exists', () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
    const keys = [...code.matchAll(/localize\('([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(keys.filter((key) => !(key in messages))).toEqual([]);
  });
});
