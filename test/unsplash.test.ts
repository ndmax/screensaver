import {describe, expect, it} from 'vitest';
import {UnsplashSource, type UnsplashPhoto} from '../src/sources/photo_source_unsplash';

function photo(over: Partial<UnsplashPhoto> = {}): UnsplashPhoto {
  return {
    width: 4000,
    height: 2000,
    urls: {raw: 'https://images.unsplash.com/photo-1?ixid=x'},
    links: {html: 'https://unsplash.com/photos/1'},
    user: {name: 'Ann', username: 'ann'},
    ...over,
  };
}

describe('UnsplashSource.processPhotos', () => {
  it('limits the larger dimension and keeps the aspect ratio', () => {
    const [p] = UnsplashSource.processPhotos([photo()]);
    expect(p.url).toBe('https://images.unsplash.com/photo-1?ixid=x&w=3500&h=1750');
    expect(p.asp).toBe('2.00');
    expect(p.author).toBe('Ann');
    expect(p.ex).toEqual({url: 'https://unsplash.com/photos/1'});
  });

  it('limits portrait height', () => {
    const [p] = UnsplashSource.processPhotos([photo({width: 2000, height: 5000})]);
    expect(p.url).toContain('&w=1400&h=3500');
  });

  it('falls back to username and skips sponsored or incomplete photos', () => {
    const out = UnsplashSource.processPhotos([
      photo({user: {name: ' ', username: 'bob'}}),
      photo({sponsored: true}),
      photo({width: 0}),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].author).toBe('bob');
  });

  it('handles missing results', () => {
    expect(UnsplashSource.processPhotos(undefined)).toEqual([]);
  });
});
