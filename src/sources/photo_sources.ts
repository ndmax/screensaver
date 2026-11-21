/**
 * Create and manage the photo sources.
 *
 * Merges scripts/sources/photo_source_factory.ts and photo_sources.ts.
 * Flickr has been removed. Reddit, Google Photos and a Chromecast replacement
 * are to be added back.
 */

import {localize} from '../lib/locale';
import * as Settings from '../lib/settings';
import {type PhotoSource, SOURCE_TYPE, USE_KEYS, type UseKey} from './photo_source';
import {UnsplashSource} from './photo_source_unsplash';

export {isUseKey} from './photo_source';

/** Create the source for a use key */
export function create(useKey: UseKey): PhotoSource {
  switch (useKey) {
    case 'useArchitectureUnsplash':
      return new UnsplashSource({
        useKey, photosKey: 'architectureUnsplashImages', type: SOURCE_TYPE.UNSPLASH,
        desc: localize('setting_unsplash_architecture'),
        isLimited: true, isDaily: true, loadArg: 'architecture',
      });
    case 'useNatureUnsplash':
      return new UnsplashSource({
        useKey, photosKey: 'natureUnsplashImages', type: SOURCE_TYPE.UNSPLASH,
        desc: localize('setting_unsplash_nature'),
        isLimited: true, isDaily: true, loadArg: 'landscape',
      });
    case 'usePeopleUnsplash':
      return new UnsplashSource({
        useKey, photosKey: 'peopleUnsplashImages', type: SOURCE_TYPE.UNSPLASH,
        desc: localize('setting_unsplash_people'),
        isLimited: true, isDaily: true, loadArg: 'people',
      });
    case 'useCityUnsplash':
      return new UnsplashSource({
        useKey, photosKey: 'cityUnsplashImages', type: SOURCE_TYPE.UNSPLASH,
        desc: localize('setting_unsplash_city'),
        isLimited: true, isDaily: true, loadArg: 'city',
      });
  }
}

/** All sources the user has selected */
export function getSelectedSources(): PhotoSource[] {
  return USE_KEYS.filter((key) => Settings.get(key)).map(create);
}

/**
 * Fetch (or delete, if deselected) the photos for one source.
 *
 * @throws An Error if processing failed
 */
export async function process(useKey: UseKey): Promise<void> {
  await create(useKey).process();
}

/**
 * Process all selected sources. Failures are logged by the source.
 *
 * @param doLimited - also update sources with API call limits
 */
export async function processAll(doLimited: boolean): Promise<void> {
  for (const source of getSelectedSources()) {
    if (doLimited || !source.isLimited) {
      await source.process().catch(() => {});
    }
  }
}

/** Process all selected sources that update daily */
export async function processDaily(): Promise<void> {
  for (const source of getSelectedSources()) {
    if (source.isDaily) {
      await source.process().catch(() => {});
    }
  }
}
