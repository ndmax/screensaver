/**
 * A photo as persisted.
 *
 * Replaces scripts/sources/photo_source.ts. The online sources and their
 * PhotoSource classes are gone; photos come from local folders
 * (sources/folders.ts).
 */
export interface Photo {
  /** file:// URL of the image */
  url: string;
  /** Label text: the photo's folder, relative to the folder the user added */
  author: string;
  /** Displayed (EXIF-rotated) aspect ratio, 3 significant digits */
  asp: string;
  /** File size in bytes, to detect changes between scans */
  size?: number;
  /** File modification time (Unix seconds), to detect changes between scans */
  mtime?: number;
}
