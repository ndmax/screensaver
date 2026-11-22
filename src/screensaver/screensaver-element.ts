/**
 * The screensaver: a set of slides with animated transitions between them.
 *
 * Ported from elements/screensaver-element. neon-animated-pages is replaced
 * by running each transition's entry/exit animations directly with the Web
 * Animations API. Weather and photo location have been removed.
 */

import {css, html, LitElement, nothing} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Settings from '../lib/settings';
import {TRANS_TYPE, type TransType, VIEW_TYPE, type ViewType} from '../lib/settings';
import {formatShort, TIME_FORMAT} from '../lib/time';
import {errMsg, getRandomInt} from '../lib/utils';
import * as PhotoSources from '../sources/photo_sources';
import * as FaceDetect from './face_detect';
import './screensaver-slide';
import type {ScreensaverSlide} from './screensaver-slide';
import {MAX_SLIDES, Slideshow, type SlideView} from './slideshow';
import {isBadAspect, type SSPhoto} from './ss_photo';
import {PhotoList} from './ss_photos';
import {getTransition} from './transitions';

/** Delay before the first photo, ms */
const START_DELAY = 1500;

/** Pick the photo sizing for this session */
function pickViewType(): ViewType {
  const type = Settings.get('photoSizing');
  return type === VIEW_TYPE.RANDOM ? getRandomInt(0, VIEW_TYPE.RANDOM - 1) as ViewType : type;
}

/** Pick the transition for this session */
function pickTransType(): TransType {
  const type = Settings.get('photoTransition');
  return type === TRANS_TYPE.RANDOM ? getRandomInt(0, TRANS_TYPE.RANDOM - 1) as TransType : type;
}

@customElement('screensaver-element')
export class ScreensaverElement extends LitElement implements SlideView {
  static override styles = css`
    :host {
      display: block;
      position: fixed;
      inset: 0;
    }
    screensaver-slide:not([shown]) {
      display: none;
    }
    .vcr {
      position: fixed;
      width: 15vh;
      height: 15vh;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      pointer-events: none;
    }
    .noPhotos {
      font-size: 5vh;
      font-weight: 600;
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      color: rgba(48, 63, 159, 1);
      opacity: 0.8;
    }
  `;

  @state() private photos: SSPhoto[] = [];
  @state() private noPhotos = false;
  @state() private timeLabel = '';

  @query('#vcr') private vcr!: HTMLImageElement;

  private viewType: ViewType = VIEW_TYPE.LETTERBOX;
  private transType: TransType = TRANS_TYPE.FADE;
  private selectedIdx = -1;
  private running: Animation[] = [];
  private timeTimer: ReturnType<typeof setTimeout> | undefined;
  private photoList = new PhotoList();
  slideshow: Slideshow | null = null;

  /** Load photos and start the show */
  async launch(): Promise<void> {
    try {
      this.viewType = pickViewType();
      this.transType = pickTransType();

      const sizing = Settings.get('photoSizing');
      const skip = Settings.get('skip') && (sizing === VIEW_TYPE.ZOOM || sizing === VIEW_TYPE.FULL);
      const screenAsp = window.innerWidth / window.innerHeight;
      for (const source of PhotoSources.getSelectedSources()) {
        this.photoList.add(await source.getPhotos(), (asp) => skip && isBadAspect(asp, screenAsp));
      }
      if (Settings.get('shuffle')) {
        this.photoList.shuffle();
      }

      const photos: SSPhoto[] = [];
      const length = Math.min(this.photoList.count, MAX_SLIDES);
      for (let i = 0; i < length; i++) {
        const photo = this.photoList.getNextUsable();
        if (photo) {
          photos.push(photo);
        }
      }
      if (!photos.length) {
        this.setNoPhotos();
        return;
      }
      this.photos = photos;
      await this.updateComplete;

      if (Settings.get('panAndScan') && Settings.get('detectFaces')) {
        // load the detector in the background
        FaceDetect.initialize().catch((err: unknown) => Log.warn(errMsg(err), 'SS.launch FaceDetect'));
      }

      this.startClock();

      this.slideshow = new Slideshow(this, this.photoList, {
        transTime: Settings.get('transitionTime').base * 1000,
        interactive: Settings.get('interactive'),
      });
      this.slideshow.start(START_DELAY);
    } catch (err) {
      Log.error(errMsg(err), 'SS.launch');
      this.setNoPhotos();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.slideshow?.dispose();
    clearTimeout(this.timeTimer);
  }

  /** The photo showing, if any */
  getSelectedPhoto(): SSPhoto | undefined {
    return this.photos[this.selectedIdx];
  }

  // --- SlideView ---

  slideCount(): number {
    return this.photos.length;
  }

  selected(): number {
    return this.selectedIdx;
  }

  getPhoto(idx: number): SSPhoto | undefined {
    return this.photos[idx];
  }

  getPhotos(): readonly SSPhoto[] {
    return this.photos;
  }

  setPhoto(idx: number, photo: SSPhoto): void {
    if (idx < 0 || idx >= this.photos.length) {
      return;
    }
    const photos = [...this.photos];
    photos[idx] = photo;
    this.photos = photos;
    // update the slide now, so its load state tracks the new photo
    const slide = this.getSlide(idx);
    if (slide) {
      slide.photo = photo;
    }
  }

  isLoaded(idx: number): boolean {
    return this.getSlide(idx)?.isLoaded() ?? false;
  }

  isError(idx: number): boolean {
    return this.getSlide(idx)?.isError() ?? true;
  }

  async prep(idx: number): Promise<void> {
    await this.getSlide(idx)?.prep();
  }

  isNoPhotos(): boolean {
    return this.noPhotos;
  }

  setNoPhotos(): void {
    this.noPhotos = true;
  }

  setPaused(paused: boolean): void {
    const vcr = this.vcr;
    if (!vcr) {
      return;
    }
    vcr.src = paused ? 'images/pause.png' : 'images/play.png';
    // show, then fade out
    vcr.getAnimations().forEach((a) => a.cancel());
    vcr.animate([{opacity: 1}, {opacity: 1, offset: 2 / 3}, {opacity: 0}], {duration: 3000, fill: 'forwards'});
  }

  /** Show a slide: run the entry animation on it and the exit animation on the old one */
  select(idx: number): void {
    const from = this.selectedIdx;
    this.selectedIdx = idx;
    const toEl = this.getSlide(idx);
    if (!toEl) {
      return;
    }
    // finish any transition still running
    for (const a of this.running) {
      a.finish();
    }

    const {entry, exit, duration} = getTransition(this.transType);
    const timing: KeyframeAnimationOptions = {duration, easing: 'ease-in-out'};
    const fromEl = from >= 0 && from !== idx ? this.getSlide(from) : null;

    toEl.setAttribute('shown', '');
    const animations = [toEl.animate(entry, timing)];
    if (fromEl) {
      animations.push(fromEl.animate(exit, timing));
    }
    this.running = animations;

    void Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() => {
      if (fromEl && this.getSlide(this.selectedIdx) !== fromEl) {
        fromEl.removeAttribute('shown');
      }
    });
  }

  // --- internals ---

  getSlide(idx: number): ScreensaverSlide | null {
    return this.renderRoot.querySelector<ScreensaverSlide>(`#slide${idx}`);
  }

  private startClock(): void {
    const fmt = Settings.get('showTime');
    if (fmt === TIME_FORMAT.NONE) {
      return;
    }
    const tick = (): void => {
      this.timeLabel = formatShort(fmt);
      // update at the next minute boundary
      this.timeTimer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    tick();
  }

  override render() {
    if (this.noPhotos) {
      return html`<div class="noPhotos">${localize('no_photos')}</div>`;
    }
    return html`
      ${this.photos.map((photo, i) => html`
        <screensaver-slide id="slide${i}" .photo=${photo} .index=${i} .viewType=${this.viewType}
                           .timeLabel=${this.timeLabel}></screensaver-slide>`)}
      <img id="vcr" class="vcr" alt="" src=${this.photos.length ? 'images/play.png' : nothing}>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'screensaver-element': ScreensaverElement;
  }
}
