/**
 * The list of all photos for a screensaver session.
 *
 * Ported from scripts/screensaver/ss_photos.ts (module state became a class).
 */

import {shuffleArray} from '../lib/utils';
import type {Photo} from '../sources/photo_source';
import {SSPhoto} from './ss_photo';

export class PhotoList {
  private photos: SSPhoto[] = [];
  private curIdx = 0;

  /**
   * Add photos.
   *
   * @param ignore - returns true to skip a photo by aspect ratio
   */
  add(photos: readonly Photo[], ignore: (asp: number) => boolean = () => false): void {
    for (const photo of photos) {
      if (!ignore(parseFloat(photo.asp))) {
        this.photos.push(new SSPhoto(photo));
      }
    }
  }

  shuffle(): void {
    shuffleArray(this.photos);
  }

  get count(): number {
    return this.photos.length;
  }

  hasUsable(): boolean {
    return this.photos.some((photo) => !photo.isBad());
  }

  get(idx: number): SSPhoto | undefined {
    return this.photos[idx];
  }

  indexOf(photo: SSPhoto): number {
    return this.photos.indexOf(photo);
  }

  /**
   * The next photo that is not bad and not in `ignores`, wrapping around.
   * Advances the current index past it.
   */
  getNextUsable(ignores: readonly (SSPhoto | undefined)[] = []): SSPhoto | null {
    for (let i = 0; i < this.photos.length; i++) {
      const index = (i + this.curIdx) % this.photos.length;
      const photo = this.photos[index];
      if (!photo.isBad() && !ignores.includes(photo)) {
        this.curIdx = index;
        this.incCurrentIndex();
        return photo;
      }
    }
    return null;
  }

  get currentIndex(): number {
    return this.curIdx;
  }

  set currentIndex(idx: number) {
    this.curIdx = idx;
  }

  private incCurrentIndex(): void {
    this.curIdx = this.curIdx === this.photos.length - 1 ? 0 : this.curIdx + 1;
  }
}
