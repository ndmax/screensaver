/**
 * Slide geometry for each photo sizing mode.
 *
 * Ported from the render* methods of elements/screensaver-slide. The original
 * mutated styles imperatively; this computes them so the slide can render
 * them declaratively (and so they can be unit tested).
 */

import {VIEW_TYPE, type ViewType} from '../lib/settings';

export type Style = Record<string, string>;

export interface SlideLayout {
  /** Box that holds the image (and, in Frame mode, draws the frame) */
  container: Style;
  img: Style;
  author: Style;
  time: Style;
}

export interface LayoutOptions {
  /** A clock is shown */
  showTime: boolean;
  /** Use the large clock */
  largeTime: boolean;
}

const px = (n: number): string => `${n}px`;
const vw = (n: number): string => `${n}vw`;
const vh = (n: number): string => `${n}vh`;

/**
 * Compute the layout for a slide.
 *
 * @param viewType - sizing mode (not RANDOM, which is resolved per session)
 * @param ar - photo aspect ratio
 * @param width - screen width in px
 * @param height - screen height in px
 */
export function computeLayout(viewType: ViewType, ar: number, width: number, height: number,
                              opts: LayoutOptions): SlideLayout {
  const layout: SlideLayout = {
    container: {left: '0px', top: '0px', width: px(width), height: px(height)},
    img: {width: '100%', height: '100%'},
    author: {},
    time: opts.largeTime ? {fontSize: '8.5vh', fontWeight: '300'} : {},
  };

  switch (viewType) {
    case VIEW_TYPE.ZOOM:
      layout.img.objectFit = 'cover';
      break;
    case VIEW_TYPE.FULL:
      layout.img.objectFit = 'fill';
      break;
    case VIEW_TYPE.LETTERBOX:
      letterbox(layout, ar, width, height, opts);
      break;
    case VIEW_TYPE.FRAME:
      frame(layout, ar, width, height);
      break;
    default:
      break;
  }
  return layout;
}

function letterbox(layout: SlideLayout, ar: number, width: number, height: number, opts: LayoutOptions): void {
  const screenAr = width / height;
  // percent of the screen width and height taken by the image
  const imgWidthPer = Math.min((ar / screenAr) * 100, 100);
  const imgHeightPer = Math.min((screenAr / ar) * 100, 100);
  const right = (100 - imgWidthPer) / 2;
  const bottom = (100 - imgHeightPer) / 2;

  const h = Math.round((imgHeightPer / 100) * height);
  const w = Math.round((imgWidthPer / 100) * width);
  layout.container = {left: px((width - w) / 2), top: px((height - h) / 2), width: px(w), height: px(h)};
  layout.img = {width: px(w), height: px(h)};

  Object.assign(layout.author, {
    textAlign: 'right',
    right: vw(right + 1),
    bottom: vh(bottom + 1),
    width: vw(imgWidthPer - 0.5),
  });
  if (opts.showTime) {
    // don't wrap the author under the clock
    Object.assign(layout.author, {textOverflow: 'ellipsis', whiteSpace: 'nowrap'});
  }
  Object.assign(layout.time, {right: vw(right + 1), bottom: vh(bottom + 3.5)});
}

function frame(layout: SlideLayout, ar: number, width: number, height: number): void {
  // frame sizes scale with the screen
  const border = height * 0.005;
  const borderBot = height * 0.05;
  const padding = height * 0.025;

  const h = Math.min((width - padding * 2 - border * 2) / ar, height - padding * 2 - border - borderBot);
  const w = h * ar;
  // size including the frame
  const frWidth = w + border * 2;
  const frHeight = h + borderBot + border;

  layout.container = {
    left: px((width - frWidth) / 2),
    top: px((height - frHeight) / 2),
    width: px(w),
    height: px(h),
    border: '0.5vh ridge WhiteSmoke',
    borderBottom: '5vh solid WhiteSmoke',
    borderRadius: '1.5vh',
    boxShadow: '1.5vh 1.5vh 1.5vh rgba(0,0,0,.7)',
  };
  layout.img = {width: px(w), height: px(h)};

  // percent of the screen taken by the frame, and left on each side of it
  const imgWidthPer = (frWidth / width) * 100;
  const sidePer = (100 - imgWidthPer) / 2;
  const imgHtPer = (frHeight / height) * 100;
  const topPer = (100 - imgHtPer) / 2;
  const padPer = 0.5;

  // author label sits on the bottom of the frame
  Object.assign(layout.author, {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'black',
    opacity: '1.0',
    fontSize: '2.5vh',
    fontWeight: '400',
    right: vw(sidePer + padPer),
    left: '',
    textAlign: 'right',
    width: vw(imgWidthPer - 2 * padPer),
    bottom: vh(topPer + 1.1),
  });
  Object.assign(layout.time, {right: vw(sidePer + 1.0), textAlign: 'right', bottom: vh(topPer + 5.0)});
}
