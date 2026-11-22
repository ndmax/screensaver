## Local Photo Screen Saver Chrome Extension

A screensaver for Chrome that shows a slide show of photos from folders on
your computer.

This is a revival of the original extension by Michael A. Updike
([opus1269/screensaver](https://github.com/opus1269/screensaver)), which
stopped working when Chrome removed Manifest V2 support. It is rebuilt with
Manifest V3, TypeScript and [Lit](https://lit.dev). The original showed photos
from Google Photos, Chromecast backgrounds, reddit and Flickr, and the weather;
those services no longer allow it, so this version reads local folders instead.

Options include:

* Wait time after the computer becomes idle
* Time between photos
* Photo display mode (letterbox, zoom, frame, full)
* Transition animations (fade, scale up, slide, spin)
* Pan and zoom ("Ken Burns"), optionally toward people's faces
* A schedule for when the screensaver, display and computer stay on
* Don't show over full screen Chrome windows (e.g. YouTube, Netflix)
* Show on all displays
* Show the time and the photo's folder name

### Setup

1. On `chrome://extensions`, open the extension's **Details** and turn on
   **Allow access to file URLs**. Without it Chrome won't let the extension
   read your photos; the Options page shows a warning with a link there.
2. In Options → **Photo Sources**, add one or more folder paths, e.g.
   `/home/me/Pictures/Hawaii 2019`. Subfolders are included. An album
   downloaded from Google Photos works once it's unzipped.

The supported formats are JPEG, PNG, WebP, GIF, AVIF and BMP. Videos and
HEIC/HEIF files are skipped (Chrome can't display HEIC), and each folder
shows how many files were skipped. Folders are rescanned when Chrome starts
and once a day. If a folder goes missing, for example an unplugged drive,
its last scanned photos keep showing.

### Building

Requires Node 22+.

```sh
npm install
npm run build                # type-check + build to dist/
npm test                     # unit tests
npm run lint
npm run test:e2e             # browser tests, see test/e2e/README.md
npm run package              # build + zip for the Chrome Web Store, see docs/store-listing.md
```

Load `dist/` from `chrome://extensions` with Developer mode on, using "Load unpacked".
