/**
 * A photo in the screensaver session.
 *
 * Ported from scripts/screensaver/ss_photo.ts.
 */

import type {Photo, SourceType} from '../sources/photo_source';

export class SSPhoto {
  private url: string;
  private bad = false;
  readonly photographer: string;
  readonly aspectRatio: number;
  readonly ex: Photo['ex'];
  readonly point?: string;
  readonly type: SourceType;

  constructor(source: Photo, type: SourceType) {
    this.url = source.url;
    this.photographer = source.author ?? '';
    this.aspectRatio = parseFloat(source.asp);
    this.ex = source.ex;
    this.point = source.point;
    this.type = type;
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

  /** Replace the url (e.g. a refreshed Google Photos url); clears bad state */
  setUrl(url: string): void {
    this.url = url;
    this.bad = false;
  }

  /** The web page for the photo, if the source has one, otherwise the image */
  getSourceUrl(): string {
    return this.ex?.url ?? this.url;
  }

  /** Open the photo's web page in a new tab */
  showSource(): void {
    void chrome.tabs.create({url: this.getSourceUrl()});
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
