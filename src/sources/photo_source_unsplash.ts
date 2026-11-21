/**
 * Photos from Unsplash search.
 * https://unsplash.com/documentation#search-photos
 *
 * Ported from scripts/sources/photo_source_unsplash.ts. Requests per refresh
 * were cut from 11 pages to MAX_PAGES because the demo API tier allows only
 * 50 requests per hour, shared by all four categories.
 */

import * as Http from '../lib/http';
import {isWhiteSpace} from '../lib/utils';
import {type Photo, PhotoSource, type PhotoSourceConfig} from './photo_source';

/** The subset of an Unsplash photo we use */
export interface UnsplashPhoto {
  width: number;
  height: number;
  sponsored?: boolean;
  urls: {raw: string};
  links: {html: string};
  user: {name: string; username: string};
}

interface UnsplashSearch {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
  errors?: string[];
}

const URL_BASE = 'https://api.unsplash.com/';
/** Max size of the larger dimension of a photo */
const MAX_SIZE = 3500;
const MAX_PHOTOS = 150;
const PER_PAGE = 30;
const MAX_PAGES = Math.ceil(MAX_PHOTOS / PER_PAGE);

/** Unsplash access key, from VITE_UNSPLASH_KEY at build time */
function getKey(): string {
  const key = import.meta.env.VITE_UNSPLASH_KEY;
  if (!key) {
    throw new Error('Unsplash API key not configured (set VITE_UNSPLASH_KEY in .env.local and rebuild).');
  }
  return key;
}

export class UnsplashSource extends PhotoSource {
  /** Convert API results to our format */
  static processPhotos(results: UnsplashPhoto[] | undefined): Photo[] {
    const photos: Photo[] = [];
    for (const photo of results ?? []) {
      if (!photo || photo.sponsored || !photo.urls?.raw || !photo.width || !photo.height ||
          !photo.user || !photo.links?.html) {
        continue;
      }
      const asp = photo.width / photo.height;
      const photog = isWhiteSpace(photo.user.name) ? photo.user.username : photo.user.name;

      let width = photo.width;
      let height = photo.height;
      if (asp >= 1.0 && width > MAX_SIZE) {
        width = MAX_SIZE;
        height = Math.round(width / asp);
      } else if (asp < 1.0 && height > MAX_SIZE) {
        height = MAX_SIZE;
        width = Math.round(height * asp);
      }
      const url = `${photo.urls.raw}&w=${width}&h=${height}`;
      PhotoSource.addPhoto(photos, url, photog, asp, {url: photo.links.html});
    }
    return photos;
  }

  constructor(config: PhotoSourceConfig) {
    super(config);
  }

  async fetchPhotos(): Promise<Photo[]> {
    const query = encodeURIComponent(this.config.loadArg ?? '');
    const baseUrl = `${URL_BASE}search/photos?per_page=${PER_PAGE}&query=${query}`;
    const headers = {'Authorization': `Client-ID ${getKey()}`, 'Accept-Version': 'v1'};
    const photos: Photo[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await Http.get(`${baseUrl}&page=${page}`, {headers});
      if (!response.ok) {
        let json: UnsplashSearch | null = null;
        try {
          json = (await response.json()) as UnsplashSearch;
        } catch {
          // not JSON
        }
        if (json?.errors?.length) {
          throw new Error(json.errors.join(' '));
        }
        throw Http.getError(response);
      }
      const json = (await response.json()) as UnsplashSearch;
      photos.push(...UnsplashSource.processPhotos(json.results));
      if (photos.length >= MAX_PHOTOS || page >= json.total_pages) {
        break;
      }
    }
    return photos;
  }
}
