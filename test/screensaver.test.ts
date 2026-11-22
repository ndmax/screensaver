import {describe, expect, it} from 'vitest';
import {TRANS_TYPE, VIEW_TYPE} from '../src/lib/settings';
import {formatShort, TIME_FORMAT} from '../src/lib/time';
import {computeLayout} from '../src/screensaver/layout';
import {isBadAspect, SSPhoto} from '../src/screensaver/ss_photo';
import {PhotoList} from '../src/screensaver/ss_photos';
import {getTransition} from '../src/screensaver/transitions';

const W = 1920;
const H = 1080;
const OPTS = {showTime: true, largeTime: false};

describe('computeLayout', () => {
  it('letterbox: wide photo fills the width, centered vertically', () => {
    const l = computeLayout(VIEW_TYPE.LETTERBOX, 2.0, W, H, OPTS);
    expect(l.container).toEqual({left: '0px', top: '60px', width: '1920px', height: '960px'});
    expect(l.img).toEqual({width: '1920px', height: '960px'});
    expect(l.author.right).toBe('1vw');
    expect(l.author.whiteSpace).toBe('nowrap');
  });

  it('letterbox: tall photo fills the height, centered horizontally', () => {
    const l = computeLayout(VIEW_TYPE.LETTERBOX, 1.0, W, H, OPTS);
    expect(l.container).toMatchObject({left: '420px', top: '0px', width: '1080px', height: '1080px'});
    expect(parseFloat(l.author.right)).toBeCloseTo(22.875, 3);
    expect(l.time.bottom).toBe('3.5vh');
  });

  it('zoom and full cover the screen', () => {
    expect(computeLayout(VIEW_TYPE.ZOOM, 1.0, W, H, OPTS).img.objectFit).toBe('cover');
    expect(computeLayout(VIEW_TYPE.FULL, 1.0, W, H, OPTS).img.objectFit).toBe('fill');
    expect(computeLayout(VIEW_TYPE.FULL, 1.0, W, H, OPTS).container.width).toBe('1920px');
  });

  it('frame fits inside the screen with its border', () => {
    const l = computeLayout(VIEW_TYPE.FRAME, 1.5, W, H, OPTS);
    const w = parseFloat(l.container.width);
    const h = parseFloat(l.container.height);
    expect(w / h).toBeCloseTo(1.5, 5);
    expect(h).toBeLessThan(H * 0.95);
    expect(l.container.borderBottom).toBe('5vh solid WhiteSmoke');
    expect(l.author.color).toBe('black');
  });

  it('large time', () => {
    expect(computeLayout(VIEW_TYPE.ZOOM, 1, W, H, {showTime: true, largeTime: true}).time.fontSize).toBe('8.5vh');
  });
});

describe('photos', () => {
  it('SSPhoto takes its label from the folder', () => {
    expect(new SSPhoto({url: 'u', author: 'Hawaii 2019 / Day 1', asp: '1.5'}).photographer).toBe('Hawaii 2019 / Day 1');
  });

  it('isBadAspect', () => {
    expect(isBadAspect(1.78, 16 / 9)).toBe(false);
    expect(isBadAspect(0.66, 16 / 9)).toBe(true);
    expect(isBadAspect(3.0, 16 / 9)).toBe(true);
  });

  it('PhotoList.add honors ignore, getNextUsable skips bad and ignored', () => {
    const list = new PhotoList();
    list.add([
      {url: 'a', author: '', asp: '1.5'},
      {url: 'b', author: '', asp: '0.5'},
      {url: 'c', author: '', asp: '1.5'},
      {url: 'd', author: '', asp: '1.5'},
    ], (asp) => asp < 1);
    expect(list.count).toBe(3);
    const a = list.getNextUsable()!;
    expect(a.url).toBe('a');
    list.get(1)!.markBad(); // c
    expect(list.getNextUsable([a])!.url).toBe('d');
    expect(list.getNextUsable([list.get(2)])!.url).toBe('a');
  });
});

describe('transitions and time', () => {
  it('every transition type has entry and exit keyframes', () => {
    for (const t of Object.values(TRANS_TYPE)) {
      const tr = getTransition(t);
      expect(tr.entry.length).toBe(2);
      expect(tr.exit.length).toBe(2);
    }
    expect(getTransition(TRANS_TYPE.SPIN_UP).duration).toBe(3000);
  });

  it('formatShort', () => {
    const t = new Date(2026, 0, 1, 15, 5).getTime();
    expect(formatShort(TIME_FORMAT.HR_12, t)).toBe('3:05');
    expect(formatShort(TIME_FORMAT.HR_24, t)).toBe('15:05');
    expect(formatShort(TIME_FORMAT.HR_12, new Date(2026, 0, 1, 0, 7).getTime())).toBe('12:07');
  });
});
