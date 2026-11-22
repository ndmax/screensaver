> **Manifest V3 port in progress (branch `mv3-lit`).** The original extension by
> Michael A. Updike stopped working when Chrome removed Manifest V2 support. This
> branch is rebuilding it with Manifest V3, TypeScript and [Lit](https://lit.dev).
> Photos now come from folders on your computer; the online photo sources
> (Google Photos, Flickr, reddit, Chromecast) and weather have been removed. The original MV2/Polymer source is kept
> in `app/` for reference until the port is complete.
>
> | Step | Status |
> |---|---|
> | 1. Vite + TypeScript + MV3 project, en_US locale, icons | done |
> | 2. chrome.storage settings, service worker (alarms, idle, keep awake, context menus) | done |
> | 3. Screensaver page in Lit | done |
> | 4. Options page in Lit (settings, error viewer, help) | done |
> | 5. Local photo folders (replace Google Photos, reddit, Chromecast) | in progress |
>
> ### Building
>
> Requires Node 22+.
>
> ```sh
> npm install
> npm run build                # type-check + build to dist/
> npm test                     # unit tests
> npm run lint
> ```
>
> Load `dist/` from `chrome://extensions` with Developer mode on, using "Load unpacked".

## Photo Screen Saver Chrome Extension

This extension displays a screensaver composed of a slide show of photos from multiple sources. Supported photo sources include:

* Your Google Photos and Albums - Note: Shared Albums are not supported
* Some background photos used by Chromecast
* Several sources from reddit
* Interesting photos from Flickr

Note: Photos from the local file system are not supported.

Many options are available to control the appearance of the slide show, including:

* Wait time after machine becomes idle to display screensaver
* Between photo time interval
* Photo display mode - (e.g., letterbox, fill screen)
* Photo transition animations - (e.g., fade, scale up)
* A scheduler to control when the screensaver, display, and computer should remain on
* Do not display over full screen Chrome windows (e.g., YouTube, Netflix)
* Show on all displays
* Display current weather
* Display time

Works great on all platforms but may be especially useful for your Chromebook.

It is free and advertising free.

It is implemented using Vanilla JavaScript and [Polymer 3](https://polymer-library.polymer-project.org/3.0/docs/devguide/feature-overview).

<br />

[View in Chrome Web Store](https://chrome.google.com/webstore/detail/kohpcmlfdjfdggcjmjhhbcbankgmppgc)

<br />

[GitHub Pages](https://opus1269.github.io/screensaver/)

<br /><br />

