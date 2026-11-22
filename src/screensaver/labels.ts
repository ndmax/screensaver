/**
 * Slide label text.
 */

import type {SSPhoto} from './ss_photo';

/** Author label: the photo's folder name, if enabled */
export function authorLabel(photo: SSPhoto | null | undefined, showPhotog: boolean): string {
  return photo && showPhotog ? photo.photographer : '';
}
