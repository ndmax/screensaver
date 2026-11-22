/** A photo from a local folder (sources/folders.ts), as persisted. */
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
