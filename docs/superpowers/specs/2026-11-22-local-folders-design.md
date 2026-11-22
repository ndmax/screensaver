# Local photo folders (step 5)

Date: 2026-11-22. Branch: `mv3-lit`.

## Intent

The owner used the original extension only to show photos from their own
Google Photos albums. Google removed the API that made that possible, and its
replacement (the Photos Picker) was judged useless for this purpose. Instead,
the owner keeps the photos on disk, for example albums downloaded from Google
Photos, and the extension shows photos from local folders.

Step 5 therefore becomes "local folders". Local folders become the **only**
photo source. The original's Google Photos, reddit and Chromecast sources are
dropped for good. So is Unsplash, which steps 1-4 had kept: the owner never
used it, and it needed a build-time API key.

## Goals

- In Options, the user keeps a **list of folder paths**. They can add a path by
  typing or pasting it, and remove any path. There is no per-folder on/off. The
  screensaver shows photos from every folder on the list.
- Subfolders are included (recursive).
- The paths are stored as plain strings in settings (`chrome.storage.local`).
- The photo list stays current without user action: rescan when the list
  changes, on the existing daily photo-update alarm, and on browser startup.

## Non-goals

- Google Photos in any form (Picker or Library API). No Google sign-in.
- reddit, Chromecast and Unsplash. Delete their leftover locale strings and
  comments. For Unsplash, the removal covers:
  - `photo_source_unsplash.ts`
  - the four `use*Unsplash` settings and their stored photo keys. Remove those
    keys from storage on update.
  - the `images.unsplash.com` optional host permission
  - `VITE_UNSPLASH_KEY`, `.env.example` and their mention in the README
  - the select/deselect-all toolbar buttons
  - the `photoSourceFailed` message, if nothing else uses it.
- Videos. HEIC/HEIF (Chrome cannot display it). Skip these silently, but
  count them so Options can say "N files skipped (unsupported format)".
  **Planner's call:** the skip count includes only videos, HEIC/HEIF and
  images that failed to decode. Other files, such as the `.json` sidecars in
  Google Takeout folders, are ignored without being counted. `-edited.jpg`
  copies next to their originals are both shown. Nothing is de-duplicated.
- Watching folders for live changes. Rescans on the triggers above are enough.
- Windows/macOS-specific polish. The owner is on Linux. Converting a
  `C:\...` path to a `file:///C:/...` URL is cheap, so do it, but don't test
  beyond that.

## Anti-goals (would count as failure even if it "works")

- Requiring a click to re-grant access after a browser restart. The
  screensaver starts unattended on idle, so it must be able to read the
  folders with nobody present. This is why Chrome's folder picker
  (`showDirectoryPicker`) was rejected.
- Requiring an extra program to be installed (native messaging host).
- Copying the photos into extension storage. Store only the list of file URLs
  and small per-photo metadata.
- Wiping a folder's photos because of a transient failure (an unmounted drive,
  for example). Keep the last good scan and report the error.

## Constraints and verified facts

A spike (Chromium 1208, unpacked MV3 extension, 2026-11-22) confirmed:

- With the **"Allow access to file URLs"** switch on for the extension
  (`chrome://extensions` → details), `fetch('file:///…/')` works **from the
  service worker** as well as from extension pages. So does `fetch` of a file,
  and an `<img src="file:///…">` in an extension page.
- A directory URL returns Chrome's HTML listing. Each entry is a line such as
  `addRow("a photo.png","a%20photo.png",0,22918,"22.4 kB",1795360497,"…");`,
  with fields name, url-encoded name, isDir (0/1), size in bytes, a size
  string, mtime in Unix seconds, and a date string. The service worker can
  parse this with a regex, since there is no DOM there.
- With the switch off, every one of those fails, and
  `chrome.extension.isAllowedFileSchemeAccess()` returns false. Unpacked
  extensions loaded with `--load-extension` default to on. A normal install
  defaults to off.
- Still to confirm on the owner's real Chrome during implementation: the same
  behaviour, and that the listing format is unchanged.

Other constraints:

- Add `file:///*` to `optional_host_permissions`, and request it with
  `chrome.permissions.request` from the user's click on "Add folder"
  (builder's call: keep it optional so the install warning stays the same for
  users who never add a folder). If it turns out file access needs the
  permission in `host_permissions` rather than optional, move it and note why.
- The screensaver lays out each photo using its aspect ratio (`Photo.asp`,
  used in `computeLayout` and `isBadAspect`) before the image loads. So a scan
  must record the aspect ratio. Phone photos usually carry an EXIF rotation, and
  Chrome's `<img>` honours it, so the stored ratio must be the **displayed**
  (rotated) one.
- Decoding thousands of full-size JPEGs on every scan would be slow. Cache the
  ratio per file keyed by path, size and mtime (all three come from the
  listing), so a rescan only reads new or changed files.
- `unlimitedStorage` is already granted, so a list of thousands of file URLs
  is fine.

## Approaches considered

1. **`file://` URLs read by the extension (chosen).** The user types a path.
   The extension reads the folder through Chrome's file-URL access. It works
   unattended and stores a plain path, as the owner asked. It needs a one-time
   switch in `chrome://extensions`.
2. **Chrome folder picker (File System Access API).** It stores a permission
   handle, not a path. Chrome asks for permission again after a restart and
   needs a click to grant it, which breaks unattended start. Rejected.
3. **Native messaging helper.** It can read any path with no switch, but it
   needs a separate program installed and maintained. Rejected as too heavy
   for a personal extension.

Before this, the owner rejected the Google Photos Picker (photos must be picked
one by one, it doesn't follow albums, and it needs a Google Cloud project).

## Design

### Settings

- New setting `photoFolders: string[]`, default `[]`. It stores the paths
  exactly as the user entered them (trimmed). Normalising to a `file:///` URL
  happens when reading.
- Settings currently only hold scalar values. If the `Settings` module needs
  changes to hold an array (type, equality check in `set`, subscribe), make them.
- **Planner's call:** add `photoFolders` to `KEEP_ON_RESTORE`. "Restore
  defaults" resets preferences, not the user's folder list.

### Folder source

- With folders as the only source, the `PhotoSource` / use-key machinery
  (`USE_KEYS`, `isUseKey`, `photo_sources.ts`, `isLimited`/`isDaily`) no
  longer earns its keep. Simplify it to whatever the folder source needs
  (builder's call). Store one photo list per folder, so that a failing folder
  keeps its last good scan. The screensaver merges all folders' lists.
- Scan (in the service worker):
  - Walk each folder recursively through the directory listings.
  - Accept `.jpg .jpeg .png .webp .gif .avif .bmp`, case-insensitive.
  - Skip dotfiles and dot-directories.
  - Guard against symlink loops with a visited-URL set and a depth limit.
- For each photo:
  - `url` is the file URL.
  - `asp` comes from the cache, or is computed by fetching the file and using
    `createImageBitmap(blob, {imageOrientation: 'from-image'})`, then closing
    the bitmap. If that is unreliable for EXIF in the worker, the builder may
    instead parse the JPEG header and EXIF orientation. The requirement is the
    displayed ratio.
  - `author` is the photo's folder name relative to the root that was added
    (for example `Hawaii 2019`, or the root folder's own name). This fills the
    original "photographer" label slot, the way the original showed album
    information.
  - `ex.url` is not set. Clicking a photo opens its `url`, which is the file
    itself.
- A file that fails to decode is skipped and counted, not fatal.
- Per-folder result stored for Options: `{path, count, skipped, error?,
  scannedAt}`.

### Triggers

- When `photoFolders` changes: scan added folders and delete the data of
  removed ones. Don't rescan unchanged folders.
- When the existing `UPDATE_PHOTOS` daily alarm fires: rescan all folders.
- On `runtime.onStartup`: rescan all folders.
- A scan already running must not overlap with a new one. Coalesce triggers.

### Options UI (Photo Sources tab, renamed "Photo folders" if it reads better)

```
Photo folders
  ⚠ Chrome is blocking file access. Turn on "Allow access to file URLs"
    for this extension.  [Open extension settings]        (only when off)

  /home/me/Pictures/Hawaii 2019        412 photos            [×]
  /media/nas/Family                    1,903 photos · 12 skipped  [×]
  /home/me/Pictures/Old                Folder not found      [×]

  [ /path/to/folder                     ]  [Add folder]
```

- "Add" validates the path by listing it right away, then shows an error
  inline if the path isn't found, isn't a directory, or has no photos.
  Duplicates are rejected, and so is a path inside another listed path.
- "Open extension settings" opens `chrome://extensions/?id=<id>` with
  `chrome.tabs.create`. Check whether Chrome allows that from an extension
  page. If not, show the instruction text only.
- File access status is re-checked when the page gains focus, because the
  user flips the switch in another tab.
- Counts and errors update live as scans finish, through storage change events.
- While the screensaver is off, the section is disabled like the other
  settings.
- The "sources coming" note from step 4 is removed.
- Remove the Reddit and Chromecast locale strings and the comments that
  mention adding them back.

### Errors

- **Failure rule (planner's call):** a scan counts as failed, and keeps the
  folder's previous photos, if the root can't be listed, if any subfolder
  can't be listed, or if it finds **zero** photos where the previous scan found
  some. (An unmounted mount point lists as an empty folder on Linux, not as
  an error.) A successful scan with fewer, but more than zero, photos is the
  real new state and replaces the list. To clear a folder, remove it from the
  list.
- If a folder fails at scan time (missing, unreadable, or file access off), keep
  its previous photos, record the error for the Options row, and log it with
  `Log.error`. Don't show a modal dialog: an unmounted drive is normal, and
  the Options row shows the error.
- If there are no photos at all, the screensaver shows its existing "no
  photos" behaviour. With no folders added, this is the state right after
  install, so the Photo Sources tab should make clear that a folder needs to be
  added.

## Testing

- Unit tests:
  - directory-listing parser, using a captured real listing
  - path to `file://` URL normalisation (Linux, spaces and `#`, Windows drive)
  - extension filter
  - aspect cache hit/miss on size or mtime change
  - add-path validation (duplicates, nested paths)
- E2E: rebuild the browser test harness inside the repo this time, under
  `test/e2e/` (the previous scripts were lost with a session scratchpad). The
  approach is Playwright Chromium plus puppeteer-core with `--load-extension`,
  and `>>>` deep selectors, with test photo folders created in a temporary
  directory. No fake network server is needed now. Cover:
  - adding and removing folders through the UI
  - counts appearing
  - nested folders
  - an EXIF-rotated JPEG getting the rotated ratio
  - unsupported files being skipped
  - a missing folder keeping its old photos
  - the file-access-off warning (toggle via the `chrome://extensions` details
    page, as in the spike)
  - the screensaver actually displaying a local photo
- Manual check on the owner's installed Chrome: the file access switch and a
  real Google Photos download folder.

## Left to the builder

- How the folder source fits into `PhotoSource` and `photo_sources.ts`.
- Aspect ratio method (`createImageBitmap` or header parsing), provided EXIF
  rotation is honoured.
- Depth limit value, scan concurrency, and how progress is shown while a large
  first scan runs.
