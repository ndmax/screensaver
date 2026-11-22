/**
 * A photo in the screensaver session.
 *
 * Ported from scripts/screensaver/ss_photo.ts.
 */

import type {Photo} from '../sources/photo_source';

export class SSPhoto {
  private url: string;
  private bad = false;
  readonly photographer: string;
  readonly aspectRatio: number;

  constructor(source: Photo) {
    this.url = source.url;
    this.photographer = source.author ?? '';
    this.aspectRatio = parseFloat(source.asp);
  }

  isBad(): boolean {
    return this.bad;
  }

  markBad(): void {
    this.bad = true;
  }

  getUrl(): string {
    return this.url;
  }

  /** Open the image file in a new tab */
  showSource(): void {
    void chrome.tabs.create({url: this.url});
  }
}

/**
 * Should a photo be skipped because it would be badly cropped (Zoom) or
 * distorted (Full) on this screen.
 *
 * @param asp - photo aspect ratio
 * @param screenAsp - screen aspect ratio
 */
export function isBadAspect(asp: number, screenAsp: number): boolean {
  const CUT_OFF = 0.5; // arbitrary
  return asp < screenAsp - CUT_OFF || asp > screenAsp + CUT_OFF;
}
