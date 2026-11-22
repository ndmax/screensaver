/**
 * One slide: a photo, its author label, and the clock.
 *
 * Ported from elements/screensaver-slide (Polymer + iron-image). The entry
 * and exit transitions are run on this element by screensaver-element; this
 * element handles layout and the pan and scan ("Ken Burns") effect.
 */

import {css, html, LitElement, nothing, type PropertyValues} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import * as Log from '../lib/log';
import * as Permissions from '../lib/permissions';
import * as Settings from '../lib/settings';
import {TRANS_TYPE, VIEW_TYPE, type ViewType} from '../lib/settings';
import {TIME_FORMAT} from '../lib/time';
import {errMsg, getRandomFloat, getRandomInt} from '../lib/utils';
import * as FaceDetect from './face_detect';
import {authorLabel} from './labels';
import {computeLayout} from './layout';
import type {SSPhoto} from './ss_photo';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@customElement('screensaver-slide')
export class ScreensaverSlide extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .image {
      position: absolute;
      overflow: hidden;
    }
    img {
      display: block;
    }
    .time {
      font-size: 5.25vh;
      font-weight: 200;
      position: fixed;
      right: 1vw;
      bottom: 3.5vh;
      margin: 0;
      color: white;
    }
    .author {
      font-size: 2.5vh;
      font-weight: 300;
      position: fixed;
      overflow: hidden;
      right: 1vw;
      bottom: 1vh;
      margin: 0;
      color: white;
    }
  `;

  @property({attribute: false}) photo: SSPhoto | undefined;
  @property({type: Number}) viewType: ViewType = VIEW_TYPE.LETTERBOX;
  @property({type: Number}) index = 0;
  @property() timeLabel = '';

  /** Screen size used for layout */
  @state() private screenW = window.innerWidth;
  @state() private screenH = window.innerHeight;

  @query('img') private img!: HTMLImageElement | null;

  /** url of the last load/error event */
  private loadedUrl = '';
  private errorUrl = '';
  private panAnimation: Animation | null = null;
  /** Displayed image size from the last layout. Measured sizes are 0 while hidden. */
  private imgSize = {width: 0, height: 0};

  /** The photo's image has loaded */
  isLoaded(): boolean {
    return !!this.photo && this.loadedUrl === this.photo.getUrl();
  }

  /** The photo's image failed to load */
  isError(): boolean {
    return !!this.photo && this.errorUrl === this.photo.getUrl();
  }

  /** Get ready to be shown: refresh layout and start pan and scan. */
  async prep(): Promise<void> {
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;
    await this.updateComplete;
    await this.startPanAndScan();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('photo')) {
      this.stopPanAndScan();
    }
  }

  private onLoad = (ev: Event): void => {
    this.loadedUrl = (ev.target as HTMLImageElement).getAttribute('src') ?? '';
  };

  private onError = (ev: Event): void => {
    this.errorUrl = (ev.target as HTMLImageElement).getAttribute('src') ?? '';
    this.dispatchEvent(new CustomEvent('image-error', {detail: {index: this.index}, bubbles: true, composed: true}));
  };

  /** Only request CORS where we need pixels and the host allows it */
  private useCors(url: string): boolean {
    return Settings.get('panAndScan') && Settings.get('detectFaces') &&
      Permissions.isInOrigins(url, Permissions.DETECT_FACES);
  }

  override render() {
    const photo = this.photo;
    if (!photo) {
      return nothing;
    }
    const url = photo.getUrl();
    const showTime = Settings.get('showTime') !== TIME_FORMAT.NONE;
    const layout = computeLayout(this.viewType, photo.aspectRatio, this.screenW, this.screenH,
        {showTime, largeTime: Settings.get('largeTime')});
    const pxOr = (v: string | undefined, full: number): number => v?.endsWith('px') ? parseFloat(v) : full;
    this.imgSize = {width: pxOr(layout.img.width, this.screenW), height: pxOr(layout.img.height, this.screenH)};
    return html`
      <div class="image" style=${styleMap(layout.container)}>
        <img src=${url} alt="" style=${styleMap(layout.img)}
             crossorigin=${this.useCors(url) ? 'anonymous' : nothing}
             @load=${this.onLoad} @error=${this.onError}>
      </div>
      ${showTime ? html`<div class="time" style=${styleMap(layout.time)}>${this.timeLabel}</div>` : nothing}
      <div class="author" style=${styleMap(layout.author)}>
        ${authorLabel(photo, Settings.get('showPhotog'))}
      </div>
    `;
  }

  private stopPanAndScan(): void {
    this.panAnimation?.cancel();
    this.panAnimation = null;
  }

  /** Bounding box of all faces, relative to the photo center, in display px */
  private async faceTarget(img: HTMLImageElement, width: number, height: number): Promise<Rect | null> {
    const boxes = await FaceDetect.detectAll(img);
    if (!boxes.length) {
      return null;
    }
    let left = img.naturalWidth;
    let right = 0;
    let top = img.naturalHeight;
    let bottom = 0;
    for (const box of boxes) {
      left = Math.min(box.left, left);
      right = Math.max(box.right, right);
      top = Math.min(box.top, top);
      bottom = Math.max(box.bottom, bottom);
    }
    const scaleX = width / img.naturalWidth;
    const scaleY = height / img.naturalHeight;
    const target: Rect = {
      x: Math.round((left + (right - left) / 2 - img.naturalWidth / 2) * scaleX),
      y: Math.round((top + (bottom - top) / 2 - img.naturalHeight / 2) * scaleY),
      width: Math.round((right - left) * scaleX),
      height: Math.round((bottom - top) * scaleY),
    };
    if (boxes.length === 1) {
      // forehead correction: taller box, shifted up, not above the photo
      target.height = Math.round(target.height * 1.2);
      target.y = Math.max(Math.round(target.y - target.height * 0.2), -(height / 2));
    }
    return target;
  }

  private async startPanAndScan(): Promise<void> {
    this.stopPanAndScan();
    const img = this.img;
    if (!Settings.get('panAndScan') || !img || !this.photo) {
      return;
    }
    const {width, height} = this.imgSize;
    if (!width || !height) {
      return;
    }
    try {
      let target: Rect | null = null;
      if (Settings.get('detectFaces') && this.useCors(this.photo.getUrl())) {
        target = await this.faceTarget(img, width, height);
      }

      const aniTime = Settings.get('transitionTime').base * 1000;
      // spin up is slower than the other transitions
      const delay = Settings.get('photoTransition') === TRANS_TYPE.SPIN_UP ? 2000 : 1000;

      let scale: number;
      let translateX: number;
      let translateY: number;
      if (target && target.width && target.height) {
        // pan and zoom to the faces
        scale = Math.min(1.6, width / target.width, height / target.height);
        const maxX = (scale - 1.0) * 0.25 * width;
        const maxY = (scale - 1.0) * 0.25 * height;
        translateX = -Math.min(maxX, Math.abs(target.x)) * Math.sign(target.x);
        translateY = -Math.min(maxY, Math.abs(target.y)) * Math.sign(target.y);
      } else {
        // random pan and zoom, kept small since we don't know the subject
        scale = 1.0 + getRandomFloat(0.2, 0.6);
        const maxDelta = (scale - 1.0) * 0.2;
        translateX = Math.round((getRandomInt(0, 1) ? -1 : 1) * width * getRandomFloat(0, maxDelta));
        translateY = Math.round((getRandomInt(0, 1) ? -1 : 1) * height * getRandomFloat(0, maxDelta));
      }

      this.panAnimation = img.animate([
        {transform: 'scale(1.0) translateX(0px) translateY(0px)'},
        {transform: `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`},
      ], {
        delay,
        duration: Math.max(0, aniTime - delay),
        iterations: 1,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
    } catch (err) {
      this.stopPanAndScan();
      Log.warn(errMsg(err), 'ScreensaverSlide.startPanAndScan');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'screensaver-slide': ScreensaverSlide;
  }
}
