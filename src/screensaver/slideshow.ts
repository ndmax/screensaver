/**
 * Slide show sequencing: timing, photo replacement, pause, and interactive
 * back/forward history.
 *
 * The class talks to the page through SlideView, so it can be unit tested.
 *
 * There is a fixed set of slides (at most MAX_SLIDES). Each holds a photo
 * that preloads while hidden. Every transition shows the next loaded slide,
 * then loads a new photo into the slide that was just hidden.
 */

import type {SSPhoto} from './ss_photo';
import type {PhotoList} from './ss_photos';

/** The page, as seen by the slide show */
export interface SlideView {
  slideCount(): number;
  /** Index of the slide showing, -1 for none */
  selected(): number;
  /** Show a slide, running the transition animation */
  select(idx: number): void;
  getPhoto(idx: number): SSPhoto | undefined;
  getPhotos(): readonly SSPhoto[];
  /** Load a new photo into a slide */
  setPhoto(idx: number, photo: SSPhoto): void;
  isLoaded(idx: number): boolean;
  isError(idx: number): boolean;
  /** Lay out the slide and start its pan and scan, before it is shown */
  prep(idx: number): Promise<void>;
  isNoPhotos(): boolean;
  setNoPhotos(): void;
  setPaused(paused: boolean): void;
}

export interface SlideshowOptions {
  /** Time between photos, ms */
  transTime: number;
  /** Allow pause/back/forward */
  interactive: boolean;
}

export const MAX_SLIDES = 10;
/** Retry interval while waiting for a photo to load, ms */
const RETRY_TIME = 500;
/** setTimeout max */
const MAX_TIMEOUT = 2147483647;

interface HistItem {
  /** Slide shown */
  currentIdx: number;
  /** Slide that was due to get a new photo */
  replaceIdx: number;
  /** Index of the shown photo in the PhotoList */
  photoId: number;
  /** PhotoList position at the time */
  photosPos: number;
}

/** Back/forward history for interactive mode */
class History {
  private arr: HistItem[] = [];
  private idx = -1;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  add(item: HistItem | null): void {
    if (item && this.idx === this.arr.length - 1) {
      // add to end
      if (this.arr.length > this.max) {
        // FIFO delete
        this.arr.shift();
        this.idx = Math.max(this.idx - 1, -1);
      }
      this.arr.push(item);
    }
    this.idx++;
  }

  clear(): void {
    this.arr = [];
    this.idx = -1;
  }

  /**
   * Step back.
   *
   * @returns the item to show and the replaceIdx to restore, and the slide
   *   to step from, or null at the beginning
   */
  back(): {item: HistItem; replaceIdx: number; nextStep: number} | null {
    if (this.idx <= 0) {
      return null;
    }
    let nextStep: number | null = null;
    let inc = 2;
    let idx = this.idx - inc;
    this.idx = idx;
    if (idx < 0) {
      if (this.arr.length > this.max) {
        // at the beginning of history
        this.idx += inc;
        return null;
      }
      // at the beginning, first time through
      this.idx = -1;
      inc = 1;
      nextStep = -1;
      idx = 0;
    }
    const item = this.arr[idx];
    return {item, replaceIdx: this.arr[idx + inc].replaceIdx, nextStep: nextStep ?? item.currentIdx};
  }
}

export class Slideshow {
  private started = false;
  private paused = false;
  /** Slide that gets a new photo on the next step */
  private replaceIdx = -1;
  /** Slide shown before the current one */
  private lastSelected = -1;
  private waitTime: number;
  private timeoutId: ReturnType<typeof setTimeout> | undefined;
  private readonly history: History;

  constructor(private readonly view: SlideView, private readonly photos: PhotoList,
              private readonly opts: SlideshowOptions) {
    this.waitTime = Math.min(MAX_TIMEOUT, opts.transTime);
    this.history = new History(Math.min(photos.count, MAX_SLIDES));
  }

  /**
   * Start the show.
   *
   * @param delay - ms before the first photo, for a smooth start
   */
  start(delay: number): void {
    this.timeoutId = setTimeout(() => void this.runShow(), delay);
  }

  /** Stop all timers */
  dispose(): void {
    clearTimeout(this.timeoutId);
  }

  isStarted(): boolean {
    return this.started;
  }

  isInteractive(): boolean {
    return this.opts.interactive;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Is the slide one of the two in the current transition */
  private isCurrentPair(idx: number): boolean {
    return idx === this.view.selected() || idx === this.lastSelected;
  }

  togglePaused(newIdx: number | null = null): void {
    if (!this.started) {
      return;
    }
    this.paused = !this.paused;
    this.view.setPaused(this.paused);
    if (this.paused) {
      this.stop();
    } else {
      this.restart(newIdx);
    }
  }

  forward(): void {
    if (this.started) {
      this.step();
    }
  }

  back(): void {
    if (!this.started) {
      return;
    }
    const res = this.history.back();
    if (res) {
      const {item, replaceIdx, nextStep} = res;
      this.photos.currentIndex = item.photosPos;
      this.replaceIdx = replaceIdx;
      const photo = this.photos.get(item.photoId);
      if (photo) {
        this.view.setPhoto(item.currentIdx, photo);
      }
      this.step(nextStep);
    }
  }

  private stop(): void {
    clearTimeout(this.timeoutId);
  }

  private restart(newIdx: number | null = null): void {
    this.setWaitTime(this.opts.transTime);
    void this.runShow(newIdx);
  }

  private step(newIdx: number | null = null): void {
    if (this.paused) {
      // show the photo and stay paused
      this.togglePaused(newIdx);
      this.togglePaused();
    } else {
      this.stop();
      this.restart(newIdx);
    }
  }

  /**
   * Show the next photo, then schedule the next call.
   *
   * @param newIdx - override the next slide (back/forward)
   */
  private async runShow(newIdx: number | null = null): Promise<void> {
    if (this.view.isNoPhotos()) {
      return;
    }
    const selected = this.view.selected();
    const viewLen = this.view.slideCount();
    let curIdx = newIdx === null ? selected : newIdx;
    curIdx = this.started ? curIdx : 0;
    // the first slide shows first, with its entry animation
    let nextIdx = !this.started ? 0 : curIdx === viewLen - 1 ? 0 : curIdx + 1;

    nextIdx = this.getNextSlideIdx(nextIdx);
    if (nextIdx !== -1) {
      this.started = true;
      await this.view.prep(nextIdx);

      if (this.opts.interactive) {
        this.history.add(newIdx === null ? this.historyItem(nextIdx) : null);
      }

      this.lastSelected = selected;
      this.view.select(nextIdx);

      if (newIdx === null) {
        // load the next photo from the list into the slide just hidden
        this.replacePhoto(this.replaceIdx);
        this.replaceIdx = this.lastSelected;
      }
    }

    clearTimeout(this.timeoutId);
    // A pause can land while prep() is pending (e.g. forward while paused
    // unpauses, steps, and re-pauses). The original then kept running.
    if (!this.paused) {
      this.timeoutId = setTimeout(() => void this.runShow(), this.waitTime);
    }
  }

  private historyItem(slideIdx: number): HistItem | null {
    const photo = this.view.getPhoto(slideIdx);
    if (!photo) {
      return null;
    }
    return {
      currentIdx: slideIdx,
      replaceIdx: this.replaceIdx,
      photoId: this.photos.indexOf(photo),
      photosPos: this.photos.currentIndex,
    };
  }

  private setWaitTime(ms: number): void {
    this.waitTime = Math.min(MAX_TIMEOUT, ms);
  }

  /** Next slide with a loaded photo, or -1 to retry soon */
  private getNextSlideIdx(idx: number): number {
    const ret = this.findLoadedPhoto(idx);
    this.setWaitTime(ret === -1 ? RETRY_TIME : this.opts.transTime);
    return ret;
  }

  private replacePhoto(idx: number): void {
    if (idx < 0 || idx === this.view.selected()) {
      return;
    }
    if (this.photos.count <= this.view.slideCount()) {
      // every photo already has a slide
      return;
    }
    const photo = this.photos.getNextUsable(this.view.getPhotos());
    if (photo) {
      this.view.setPhoto(idx, photo);
    }
  }

  /**
   * Find a slide whose photo has loaded, starting at idx. Marks photos that
   * failed to load as bad, and refills the slides if they are all bad.
   *
   * @returns slide index, or -1 if none ready
   */
  private findLoadedPhoto(idx: number): number {
    if (!this.hasUsablePhoto()) {
      this.replaceAllPhotos();
    }
    if (this.view.isLoaded(idx)) {
      return idx;
    }
    const len = this.view.slideCount();
    for (let i = 0; i < len; i++) {
      const index = (i + idx) % len;
      if (this.isCurrentPair(index)) {
        continue;
      }
      const photo = this.view.getPhoto(index);
      if (this.view.isLoaded(index)) {
        return index;
      }
      if (photo && this.view.isError(index) && !photo.isBad()) {
        photo.markBad();
        if (!this.photos.hasUsable()) {
          this.view.setNoPhotos();
          return -1;
        }
      }
    }
    return -1;
  }

  private hasUsablePhoto(): boolean {
    const len = this.view.slideCount();
    for (let i = 0; i < len; i++) {
      if (!this.isCurrentPair(i) && !this.view.getPhoto(i)?.isBad()) {
        return true;
      }
    }
    return false;
  }

  private replaceAllPhotos(): void {
    const len = this.view.slideCount();
    for (let i = 0; i < len; i++) {
      if (this.isCurrentPair(i)) {
        continue;
      }
      const photo = this.photos.getNextUsable(this.view.getPhotos());
      if (!photo) {
        break;
      }
      this.view.setPhoto(i, photo);
    }
    this.history.clear();
  }
}
