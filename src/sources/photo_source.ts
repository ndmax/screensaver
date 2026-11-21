/**
 * Base class for a source of photos for the screensaver.
 *
 * Ported from scripts/sources/photo_source.ts.
 */

import {localize} from '../lib/locale';
import * as Log from '../lib/log';
import * as Msg from '../lib/msg';
import * as Settings from '../lib/settings';
import {errMsg, isWhiteSpace} from '../lib/utils';

/** Enum-like source type, persisted with photos */
export const SOURCE_TYPE = {
  UNSPLASH: 'Unsplash',
} as const;
export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE];

/** Setting keys that select a photo source */
export const USE_KEYS = [
  'useArchitectureUnsplash',
  'useNatureUnsplash',
  'usePeopleUnsplash',
  'useCityUnsplash',
] as const satisfies readonly Settings.SettingKey[];
export type UseKey = (typeof USE_KEYS)[number];

export function isUseKey(key: string): key is UseKey {
  return (USE_KEYS as readonly string[]).includes(key);
}

/** A photo as persisted */
export interface Photo {
  url: string;
  author: string;
  /** Aspect ratio, 3 significant digits */
  asp: string;
  /** Source specific extra info, e.g. {url} of the photo's web page */
  ex?: {url?: string; [key: string]: unknown};
  /** 'lat lon' */
  point?: string;
}

/** All the photos from a source */
export interface Photos {
  type: SourceType;
  photos: Photo[];
}

export interface PhotoSourceConfig {
  useKey: UseKey;
  /** chrome.storage.local key for the photos */
  photosKey: string;
  type: SourceType;
  /** Human readable description */
  desc: string;
  /** The API has call limits, so skip on non-essential refreshes */
  isLimited: boolean;
  /** Refresh daily */
  isDaily: boolean;
  /** Source specific argument, e.g. a search term */
  loadArg?: string;
}

export abstract class PhotoSource {
  static addPhoto(photos: Photo[], url: string, author: string, asp: number,
                  ex?: Photo['ex'], point = ''): void {
    const photo: Photo = {url, author, asp: asp.toPrecision(3)};
    if (ex) {
      photo.ex = ex;
    }
    if (!isWhiteSpace(point)) {
      photo.point = point;
    }
    photos.push(photo);
  }

  static createPoint(lat: number, lon: number): string {
    return `${lat} ${lon}`;
  }

  protected constructor(protected readonly config: PhotoSourceConfig) {}

  /**
   * Retrieve the photos from the remote service.
   *
   * @throws An Error if the fetch failed
   */
  abstract fetchPhotos(): Promise<Photo[]>;

  get useKey(): UseKey {
    return this.config.useKey;
  }

  get photosKey(): string {
    return this.config.photosKey;
  }

  get desc(): string {
    return this.config.desc;
  }

  get isLimited(): boolean {
    return this.config.isLimited;
  }

  get isDaily(): boolean {
    return this.config.isDaily;
  }

  /** Is the source selected by the user */
  use(): boolean {
    return Settings.get(this.config.useKey);
  }

  /** Get the stored photos, empty if the source is not selected */
  async getPhotos(): Promise<Photos> {
    const ret: Photos = {type: this.config.type, photos: []};
    if (this.use()) {
      const res = await chrome.storage.local.get(this.config.photosKey);
      ret.photos = (res[this.config.photosKey] as Photo[] | undefined) ?? [];
    }
    return ret;
  }

  /**
   * Fetch and store the photos if selected, otherwise delete them.
   *
   * @throws An Error if the fetch or save failed
   */
  async process(): Promise<void> {
    if (!this.use()) {
      await chrome.storage.local.remove(this.config.photosKey).catch(() => {});
      return;
    }
    try {
      const photos = await this.fetchPhotos();
      await this.save(photos);
    } catch (err) {
      const title = `${localize('err_photo_source_title')}: ${this.config.desc}`;
      Log.error(errMsg(err), `PhotoSource.process(${this.config.useKey})`, title);
      throw err;
    }
  }

  private async save(photos: Photo[]): Promise<void> {
    if (!photos.length) {
      return;
    }
    try {
      await chrome.storage.local.set({[this.config.photosKey]: photos});
    } catch (err) {
      Msg.broadcast({message: 'storageExceeded'});
      throw new Error(`Failed to save photos: ${errMsg(err)}`, {cause: err});
    }
  }
}
