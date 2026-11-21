import {describe, expect, it} from 'vitest';
import {isInOrigins, type PermType} from '../src/lib/permissions';

const TYPE: PermType = {
  name: 'permDetectFaces',
  permissions: [],
  origins: ['https://images.unsplash.com/*', 'https://*.googleusercontent.com/*'],
};

describe('isInOrigins', () => {
  it('matches an exact host', () => {
    expect(isInOrigins('https://images.unsplash.com/photo-123?w=10', TYPE)).toBe(true);
  });

  it('matches wildcard subdomains and the bare domain', () => {
    expect(isInOrigins('https://lh3.googleusercontent.com/abc', TYPE)).toBe(true);
    expect(isInOrigins('https://googleusercontent.com/abc', TYPE)).toBe(true);
  });

  it('rejects other hosts, look-alikes and schemes', () => {
    expect(isInOrigins('https://plus.unsplash.com/x', TYPE)).toBe(false);
    expect(isInOrigins('https://evilgoogleusercontent.com/x', TYPE)).toBe(false);
    expect(isInOrigins('http://images.unsplash.com/x', TYPE)).toBe(false);
    expect(isInOrigins('not a url', TYPE)).toBe(false);
  });
});
