/**
 * Slide label text.
 */

import {localize} from '../lib/locale';
import {isWhiteSpace} from '../lib/utils';
import type {SSPhoto} from './ss_photo';

/** Author label, e.g. 'Ann / Unsplash' */
export function authorLabel(photo: SSPhoto | null | undefined, showPhotog: boolean): string {
  if (!photo) {
    return '';
  }
  let type: string = photo.type;
  const idx = type.search('User');
  if (idx !== -1) {
    // the user's own photos
    if (!showPhotog) {
      return '';
    }
    type = type.substring(0, idx - 1);
  }
  return isWhiteSpace(photo.photographer)
    ? `${localize('photo_from')} ${type}`
    : `${photo.photographer} / ${type}`;
}
