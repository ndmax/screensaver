import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MAX_SLIDES, Slideshow, type SlideView} from '../src/screensaver/slideshow';
import type {SSPhoto} from '../src/screensaver/ss_photo';
import {PhotoList} from '../src/screensaver/ss_photos';

const TRANS = 10_000;

function makeList(n: number): PhotoList {
  const list = new PhotoList();
  list.add(Array.from({length: n}, (_, i) => ({url: `p${i}`, author: `a${i}`, asp: '1.50'})));
  return list;
}

/** In-memory stand-in for screensaver-element */
class FakeView implements SlideView {
  slides: SSPhoto[] = [];
  sel = -1;
  shown: string[] = [];
  failing = new Set<string>();
  noPhotos = false;
  paused: boolean[] = [];

  constructor(list: PhotoList) {
    for (let i = 0; i < Math.min(list.count, MAX_SLIDES); i++) {
      this.slides.push(list.getNextUsable()!);
    }
  }
  slideCount() { return this.slides.length; }
  selected() { return this.sel; }
  select(idx: number) { this.sel = idx; this.shown.push(this.slides[idx].getUrl()); }
  getPhoto(idx: number) { return this.slides[idx]; }
  getPhotos() { return this.slides; }
  setPhoto(idx: number, photo: SSPhoto) { this.slides[idx] = photo; }
  isLoaded(idx: number) { return !!this.slides[idx] && !this.failing.has(this.slides[idx].getUrl()); }
  isError(idx: number) { return !!this.slides[idx] && this.failing.has(this.slides[idx].getUrl()); }
  prep() { return Promise.resolve(); }
  isNoPhotos() { return this.noPhotos; }
  setNoPhotos() { this.noPhotos = true; }
  setPaused(p: boolean) { this.paused.push(p); }
}

function setup(nPhotos: number, interactive = false) {
  const list = makeList(nPhotos);
  const view = new FakeView(list);
  const show = new Slideshow(view, list, {transTime: TRANS, interactive});
  return {list, view, show};
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Slideshow', () => {
  it('shows slides in order on the transition timer', async () => {
    const {view, show} = setup(5);
    show.start(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(view.shown).toEqual(['p0']);
    expect(show.isStarted()).toBe(true);
    await vi.advanceTimersByTimeAsync(TRANS * 5);
    expect(view.shown).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p0']);
  });

  it('cycles every photo through the slides when there are more photos than slides', async () => {
    const {view, show} = setup(25);
    show.start(0);
    await vi.advanceTimersByTimeAsync(TRANS * 40);
    const seen = new Set(view.shown);
    expect(seen.size).toBe(25);
    // never the same photo twice in a row
    for (let i = 1; i < view.shown.length; i++) {
      expect(view.shown[i]).not.toBe(view.shown[i - 1]);
    }
  });

  it('skips a photo that fails to load and marks it bad', async () => {
    const {view, show} = setup(5);
    view.failing.add('p1');
    show.start(0);
    await vi.advanceTimersByTimeAsync(TRANS * 2 + 1);
    expect(view.shown).toEqual(['p0', 'p2', 'p3']);
    expect(view.slides[1].isBad()).toBe(true);
  });

  it('reports no photos when every photo fails', async () => {
    const {view, show} = setup(3);
    for (const p of ['p0', 'p1', 'p2']) {
      view.failing.add(p);
    }
    show.start(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(view.noPhotos).toBe(true);
    expect(view.shown).toEqual([]);
  });

  it('retries quickly while no slide is loaded', async () => {
    const {view, show} = setup(2);
    view.failing.add('p0');
    view.failing.add('p1');
    // not bad yet: the error clears, e.g. the network came back
    view.isError = () => false;
    show.start(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(view.shown).toEqual([]);
    view.failing.clear();
    await vi.advanceTimersByTimeAsync(600);
    expect(view.shown).toEqual(['p0']);
  });

  it('pause stops the show and resume continues it', async () => {
    const {view, show} = setup(5, true);
    show.start(0);
    await vi.advanceTimersByTimeAsync(1);
    show.togglePaused();
    expect(view.paused).toEqual([true]);
    await vi.advanceTimersByTimeAsync(TRANS * 3);
    expect(view.shown).toEqual(['p0']);
    show.togglePaused();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.paused).toEqual([true, false]);
    expect(view.shown).toEqual(['p0', 'p1']);
  });

  it('forward steps immediately and back returns to the previous photo', async () => {
    const {view, show} = setup(25, true);
    show.start(0);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(TRANS * 3);
    expect(view.shown.at(-1)).toBe('p3');
    show.forward();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.shown.at(-1)).toBe('p4');
    show.back();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.shown.at(-1)).toBe('p3');
    show.back();
    await vi.advanceTimersByTimeAsync(1);
    expect(view.shown.at(-1)).toBe('p2');
  });

  it('forward while paused shows the next photo and stays paused', async () => {
    const {view, show} = setup(5, true);
    show.start(0);
    await vi.advanceTimersByTimeAsync(1);
    show.togglePaused();
    show.forward();
    await vi.advanceTimersByTimeAsync(TRANS * 3);
    expect(show.isPaused()).toBe(true);
    expect(view.shown).toEqual(['p0', 'p1']);
  });

  it('ignores controls before the show starts', () => {
    const {view, show} = setup(5, true);
    show.togglePaused();
    show.forward();
    show.back();
    expect(view.paused).toEqual([]);
    expect(view.shown).toEqual([]);
  });
});
