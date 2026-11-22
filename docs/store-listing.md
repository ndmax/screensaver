# Chrome Web Store listing

Text to paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole)
when submitting. Build the upload with `npm run package`, which writes
`release/photo-screensaver-<version>.zip`. Bump `version` in both
`package.json` and `public/manifest.json` before each upload; the script
refuses to run if they differ.

## Name

**Local Photo Screen Saver**, taken from the manifest
(`chrome_extension_name` in `public/_locales/en_US/messages.json`). The
original extension was listed as "Photo Screen Saver" by another developer;
the different name keeps this listing distinct so it isn't flagged as impersonation.

## Summary (manifest description, 132 characters max)

> A screensaver that shows a slide show of photos from folders on your computer.

## Description

```text
A screensaver for Chrome that shows a slide show of photos from folders on your computer.

This is a community revival of the Photo Screen Saver extension originally written by Michael A. Updike (opus1269), which stopped working when Chrome removed support for Manifest V2 extensions. It has been rebuilt for Manifest V3. The online photo sources of the original (Google Photos, Chromecast, reddit, Flickr) and the weather display are gone because those services no longer allow it; this version shows photos from local folders, including albums you have downloaded from Google Photos.

FEATURES
• Starts after the computer has been idle for a time you choose
• Choose the time between photos
• Display modes: letterbox, zoom, frame, full
• Transitions: fade, scale up, slide, spin
• Pan and zoom ("Ken Burns"), optionally toward people's faces (face detection runs entirely on your computer)
• A schedule for when the screensaver runs and when the display and computer stay awake
• Optionally don't show over full screen Chrome windows (YouTube, Netflix, ...)
• Show on all displays
• Show the time and the photo's folder name
• Keyboard shortcuts to pause and step back and forward

SETUP (required)
1. Open chrome://extensions, click Details on Local Photo Screen Saver, and turn on "Allow access to file URLs". Chrome does not let the extension read your photos without it.
2. Open the extension's Options → Photo Sources and add one or more folders, for example /home/me/Pictures/Hawaii 2019 or C:\Users\me\Pictures\Hawaii 2019. Subfolders are included.

Supported formats: JPEG, PNG, WebP, GIF, AVIF and BMP. Videos and HEIC files are skipped.

PRIVACY
Your photos never leave your computer. The extension makes no network requests and collects no data.

Source code and issues: https://github.com/ndmax/screensaver
```

## Listing details

| Field | Value |
| --- | --- |
| Category | Accessibility (or Fun) |
| Language | English (United States) |
| Homepage URL | https://github.com/ndmax/screensaver |
| Support URL | https://github.com/ndmax/screensaver/issues |
| Privacy policy URL | https://github.com/ndmax/screensaver/blob/master/PRIVACY.md |

Images to make: at least one screenshot (1280×800 or 640×400), a small promo
tile (440×280). The 128×128 icon is `public/images/icon_128.png`. The marquee
(1400×560) is optional.

## Privacy practices tab

**Single purpose**

```text
Shows a full-screen slide show of photos from folders on the user's computer when the computer is idle.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `idle` | Detects when the computer becomes idle so the screensaver can start, and when the user returns so it can close. |
| `power` | Keeps the display (or the computer) awake while the screensaver is showing or during the user's schedule. |
| `system.display` | Finds the connected displays so the screensaver can cover each one when "Show on all displays" is on. |
| `alarms` | Runs the user's on/off schedule and the daily rescan of photo folders. |
| `storage` | Saves the user's settings. |
| `unlimitedStorage` | Stores the list of photos found in the user's folders, which can exceed the default storage quota for large libraries. |
| `contextMenus` | Adds "Display now" and "Enable/disable" items to the toolbar button's right-click menu. |
| `background` (optional) | Only if the user turns it on: lets the screensaver keep working while all Chrome windows are closed. |
| Host permission `file:///*` | Reads photos from the local folders the user adds in Options. This is the extension's only photo source; it reads only the folders the user lists. |

**Remote code**: No, I am not using remote code. (The face-detection
WebAssembly and model are bundled in the package and loaded from the
extension.)

**Data usage**: tick none of the data types. Check all three certifications
(not sold to third parties; not used for unrelated purposes; not used for
creditworthiness or lending).

## Distribution

Visibility: Public, or Unlisted to share by link only. Regions: all.
