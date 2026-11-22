# Local Photo Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a user-managed list of local folder paths the extension's only photo source. Remove Unsplash and the leftovers of the dropped sources.

**Architecture:** The service worker reads folders through `file://` URLs. This needs "Allow access to file URLs" turned on and `file:///*` in `host_permissions`. A pure module (`src/sources/folders.ts`) parses Chrome's directory listings, walks the folder tree and builds `Photo` records, with `fetch` and the image-size probe injected so it can be unit-tested. A small store module keeps one record per folder in `chrome.storage.local`, holding the photos and a status. The screensaver merges every folder's photos. Options has a folder-list control.

**Tech Stack:** TypeScript 6.0, Lit 3, Vite 8, Vitest, MV3 service worker; puppeteer-core with Playwright's Chromium 1208 for E2E.

**Spec:** `docs/superpowers/specs/2026-11-22-local-folders-design.md`

## Global Constraints

- The folder list is setting `photoFolders: string[]`, default `[]`. It is kept on "Restore defaults".
- Accepted photo extensions, case-insensitive: `.jpg .jpeg .png .webp .gif .avif .bmp`.
- Counted as skipped: videos (`.mp4 .mov .m4v .webm .avi .3gp .mkv`), `.heic .heif`, and images that fail to decode. Every other file is ignored without being counted. Dotfiles and dot-directories are skipped.
- Failure rule: a scan has failed if the root or any subfolder can't be listed, or if it finds 0 photos where the previous scan found more than 0. A failed scan keeps the previous photos and records the error. Any other scan replaces the photos.
- `asp` is the displayed (EXIF-rotated) width/height. It is reused from the previous scan when the file's `size` and `mtime` are unchanged.
- `author` is the photo's directory relative to the folder root, joined with ` / `, or the root's own base name for files at the top level.
- No modal dialogs for folder errors; the error is shown in the Options row and logged with `Log.error`.
- Verified on 2026-11-22 (Chromium 1208, spikes):
  - With file access on, `fetch(file://…)` and directory listings work in the service worker.
  - `createImageBitmap` there returns the EXIF-rotated size.
  - `file://` images in extension pages are canvas-readable without CORS, so face detection needs no extra permission.

## Review Focus

1. **A file-access switch that is off.** Both the scan and adding a folder must report "file access is off" rather than "folder not found". Covered by the Task 2 `scanFolder` test and the Task 5 E2E check.
2. **Paths with spaces, `#`, `%`, `?` or non-ASCII characters.** Each path segment must be URL-encoded when the `file://` URL is built, and decoded names used for labels. Covered by Task 2 `pathToUrl` and `parseListing` tests.
3. **A large first scan (thousands of photos).** The service worker must not be killed partway through. Write a progress status at least every 5 s; each write resets the idle timer. Covered by a Task 3 test that checks status writes during a scan.
4. **Overlapping triggers.** A startup rescan plus a folder added at the same time must not run two scans of one folder or lose the add. Covered by a Task 3 test that checks triggers are queued.
5. **Removing a folder while it is being scanned.** It must not reappear with photos. Covered by a Task 3 test.

---

### Task 1: Remove Unsplash and the leftovers of the dropped sources

**Files:**
- Delete: `src/sources/photo_source_unsplash.ts`, `src/sources/photo_sources.ts`, `test/unsplash.test.ts`, `.env.example`
- Modify:
  - `src/sources/photo_source.ts`: keep only the `Photo` type. Remove `SourceType`, `Photos`, `PhotoSource` and the use keys.
  - `src/lib/settings.ts`: drop the four `use*Unsplash` keys and `permDetectFaces`. Add `photoFolders`.
  - `src/lib/permissions.ts`: drop `DETECT_FACES`, `isInOrigins` and the Unsplash origin.
  - `src/lib/msg.ts`: drop `photoSourceFailed`.
  - `src/background/data.ts`: `DATA_VERSION = 2`. `migrate()` removes the old keys. Add `photoFolders` to `KEEP_ON_RESTORE`.
  - `src/background/alarm.ts`
  - `src/screensaver/*`: `type` leaves `SSPhoto` and `PhotoList`.
  - `src/screensaver/labels.ts`: `authorLabel(photo, showPhotog)` returns `showPhotog ? photo.photographer : ''`.
  - `src/screensaver/screensaver-slide.ts`: no `crossorigin`.
  - `src/options/settings-page.ts`: the detect-faces toggle saves directly. Remove the sources list and the select/deselect-all buttons.
  - `src/options/main.ts`
  - `public/manifest.json`: replace `optional_host_permissions` with `"host_permissions": ["file:///*"]`.
  - `public/_locales/en_US/messages.json`: remove `setting_unsplash_*`, `setting_reddit_*`, `setting_chromecast*`, `google_*`, `menu_google`, `tooltip_google_*`, `err_google_*`, `err_detect_faces_perm` and `sources_coming`, plus any other key no longer referenced from `src/`.
  - `src/vite-env.d.ts`
  - `README.md`
  - `test/permissions.test.ts`, `test/screensaver.test.ts`, `test/slideshow.test.ts`, `test/settings.test.ts`

**Interfaces:**
- Produces: `Photo {url: string; author: string; asp: string; size: number; mtime: number}` in `src/sources/photo_source.ts`. `Settings.photoFolders: string[]`. `PhotoList.add(photos: Photo[], ignore?)`.

- [ ] Step 1: Update tests first.
  - `authorLabel(photo('Ann'), true) === 'Ann'` and `authorLabel(photo('Ann'), false) === ''`.
  - `DEFAULTS.photoFolders` deep-equals `[]`.
  - Remove the Unsplash and `isInOrigins` tests.
- [ ] Step 2: Make the source changes listed above. Temporarily replace the screensaver's photo loading with an empty list, which Task 3 fills in.
- [ ] Step 3: Add an unused-locale-key check, `test/locale.test.ts`. It reads `messages.json` and greps `src/` and `public/manifest.json` for `localize('key'`, `localize("key"`, `'key'` or `__MSG_key__`. It fails if any key is never referenced, except an allowlist for keys built dynamically; collect those by grepping first.
- [ ] Step 4: `npm run typecheck && npm run lint && npm test` all pass. `grep -rni "unsplash\|reddit\|chromecast" src public test` returns nothing.
- [ ] Step 5: Commit "Remove Unsplash and dropped-source leftovers".

### Task 2: Folder scanning library

**Files:**
- Create: `src/sources/folders.ts`, `test/folders.test.ts`, `test/fixtures/listing.html` (a real listing captured from Chromium, with a subdirectory, a file with a space, and a non-ASCII name)

**Interfaces:**
- Produces:
  - `pathToUrl(path: string): string`: trims; handles `~` (unchanged) and Windows `C:\a\b` → `file:///C:/a/b/`; encodes each segment; always ends in `/`.
  - `parseListing(html: string): Entry[]` where `Entry {name: string; isDir: boolean; size: number; mtime: number}`, with `name` decoded. Skips `..`.
  - `classify(name: string): 'photo' | 'skip' | 'ignore'`
  - `validateNewPath(path: string, existing: string[]): 'empty' | 'duplicate' | 'nested' | null`. Compares normalised paths (trailing slashes removed). `nested` means either path contains the other.
  - `scanFolder(root: string, prev: Photo[], io: ScanIO): Promise<ScanResult>`
    - `ScanIO {list(url: string): Promise<string>; probe(url: string): Promise<{width: number; height: number}>; fileAccess(): Promise<boolean>; onProgress?(found: number): void}`
    - `ScanResult {photos: Photo[]; skipped: number; error?: string}`
  - `MAX_DEPTH = 20`, `PROBE_CONCURRENCY = 4`
  - The error strings are locale keys: `folder_err_no_access`, `folder_err_not_found`, `folder_err_subfolder`, `folder_err_empty`.

- [ ] Step 1: Write tests.
  - `parseListing` on the fixture.
  - `pathToUrl`:
    - `'/home/a b/#1'` → `'file:///home/a%20b/%231/'`
    - `'C:\\Pics'` → `'file:///C:/Pics/'`
    - trailing slash kept single.
  - `classify`: `'A.JPG'` photo, `'x.heic'` skip, `'x.mp4'` skip, `'x.json'` ignore.
  - `validateNewPath`: duplicate with a trailing slash, nested in both directions, `'/a/b'` vs `'/a/bc'` is **not** nested.
  - `scanFolder` with a fake `io` built from an in-memory tree:
    - recursive photos with `author`s (`'root'` for the top level, `'Hawaii 2019'` and `'Hawaii 2019 / Day 1'` for deeper);
    - `probe` not called for a `prev` photo with the same url, size and mtime, and called when mtime changes;
    - a probe rejection gives `skipped += 1`;
    - a skip-type file counts and a json file doesn't;
    - root list rejects with `fileAccess()` false → error `folder_err_no_access`;
    - root list rejects with access true → `folder_err_not_found`;
    - a subfolder list rejects → `folder_err_subfolder` and `photos` equal to `prev`;
    - 0 photos with a non-empty `prev` → `folder_err_empty` and `photos` equal to `prev`;
    - 0 photos with an empty `prev` → no error;
    - a symlink loop (a directory listing that repeats its own url) terminates;
    - dot entries ignored.
- [ ] Step 2: Run `npx vitest run test/folders.test.ts` and confirm it fails because the module is missing.
- [ ] Step 3: Implement. Walk breadth-first with a visited-url set and `MAX_DEPTH`. Run probes through a pool of `PROBE_CONCURRENCY`. `asp = (width/height).toPrecision(3)`.
- [ ] Step 4: Tests pass; `npm run typecheck && npm run lint` pass.
- [ ] Step 5: Commit "Add folder scanning library".

### Task 3: Folder store, scan triggers and screensaver loading

**Files:**
- Create: `src/sources/folder_store.ts`, `test/folder_store.test.ts`
- Modify: `src/background/data.ts`, `src/background/alarm.ts`, `src/background/index.ts`, `src/screensaver/screensaver-element.ts`

**Interfaces:**
- Consumes: Task 2 `scanFolder` and `pathToUrl`; `Settings.photoFolders`.
- Produces:
  - Storage key `folder:<path>` (path as entered) → `FolderRecord {photos: Photo[]; status: FolderStatus}`, with `FolderStatus {count: number; skipped: number; error?: string; scannedAt: number; scanning: boolean; found?: number}`.
  - `folderKey(path: string): string`
  - `loadRecords(paths: string[]): Promise<Record<string, FolderRecord | undefined>>`
  - `allPhotos(): Promise<Photo[]>`, which reads the records for `Settings.get('photoFolders')`
  - `sync(opts: {rescan: boolean}): Promise<void>`
    - Removes records for paths no longer listed.
    - Scans the listed paths that have no record; with `rescan`, it scans every path.
    - Runs are serialised through one module-level promise chain. A call while a run is in progress queues at most one follow-up run, which merges `rescan` with OR.
    - Before writing a scan result, it checks that the path is still listed.
  - `swIO(): ScanIO`
    - `list` = `fetch(url).then(r => r.text())`.
    - `probe` = fetch, then `createImageBitmap(blob)`, then read the size and `close()`.
    - `fileAccess` = `chrome.extension.isAllowedFileSchemeAccess()`.
  - While scanning, `onProgress` writes the status with `scanning: true` and `found`, throttled to once every 2 s.

- [ ] Step 1: Tests with the chrome mock (`test/chrome-mock.ts`) and an injected `ScanIO`:
  - Adding a path creates a record with a count. Removing it deletes the record.
  - Two `sync` calls in a row while a scan is pending run only once per path. The second call's rescan still happens.
  - Removing a path during its scan leaves no record afterwards.
  - Progress writes happen during a slow scan (fake timers).
  - A failing rescan keeps the previous photos and sets `error`.
- [ ] Step 2: Confirm the tests fail.
- [ ] Step 3: Implement `folder_store.ts`. Wire the triggers:
  - `data.ts`: `processState('photoFolders')` → `sync({rescan: false})`, and `'all'` → `sync({rescan: true})`.
  - `alarm.ts`: `UPDATE_PHOTOS` → `sync({rescan: true})`.
  - `onStartup` already calls `processState('all')`.
  - `screensaver-element.ts`: `launch()` uses `FolderStore.allPhotos()`.
- [ ] Step 4: Tests pass; `npm run typecheck && npm run lint && npm test` pass.
- [ ] Step 5: Commit "Scan folders in the service worker and show their photos".

### Task 4: Options folder-list UI

**Files:**
- Create: `src/options/folder-list.ts` (`<folder-list>`)
- Modify: `src/options/settings-page.ts` (the sources tab renders `<folder-list ?disabled=${!enabled}>`), `src/options/icons.ts` (add `folder` and `close` if missing), `public/_locales/en_US/messages.json`

**Interfaces:**
- Consumes:
  - `Settings.photoFolders`
  - `FolderStore.folderKey`, `loadRecords`
  - `pathToUrl`, `validateNewPath`
  - the locale error keys from Task 2
- Produces:
  - Element `folder-list` with a `disabled` property.
  - DOM hooks for E2E:
    - `#path` (input), `#add` (button), `#addError`
    - `.folder` rows with `data-path`, `.count`, `.error`, `.remove`
    - `#fileAccess` warning, `#openExtSettings`

- [ ] Step 1: Implement the element.
  - **Rows:**
    - Row text is the path. The status reads `N photos`, with `· M skipped` when M > 0, `Scanning… N found` while scanning, or the localized error.
    - The rows update from `chrome.storage.onChanged` for `folder:` keys and `photoFolders`.
  - **Add:**
    1. Check the path with `validateNewPath`, then with `fileAccess`.
    2. Fetch `pathToUrl(path)` from the page. If that fails, fetch the path without the trailing slash: success there means `folder_err_not_dir`, failure means `folder_err_not_found`.
    3. Then `Settings.set('photoFolders', [...list, path])` and clear the input.
    4. Pressing Enter in the input also adds.
  - **Remove** sets the list without the path.
  - **File access warning:**
    - Shown when `chrome.extension.isAllowedFileSchemeAccess()` is false. Re-checked on `window` `focus` and `visibilitychange`.
    - Button text "Open extension settings". It calls `chrome.tabs.create({url: 'chrome://extensions/?id=' + chrome.runtime.id})`. If that throws, hide the button and leave the text.
  - **Empty list:** show the `folders_empty` hint.
  - **Locale strings to add:**
    - `folders_title`: "Photo folders"
    - `folders_empty`: "Add a folder of photos to show in the screensaver. Subfolders are included."
    - `folders_add`: "Add folder"
    - `folders_path_placeholder`: "/path/to/folder"
    - `folders_count`: "$1 photos"
    - `folders_skipped`: "$1 skipped"
    - `folders_scanning`: "Scanning… $1 found"
    - `folder_err_no_access`: "Chrome is blocking file access"
    - `folder_err_not_found`: "Folder not found"
    - `folder_err_not_dir`: "Not a folder"
    - `folder_err_subfolder`: "Some subfolders couldn't be read; showing the last good scan"
    - `folder_err_empty`: "No photos found; showing the last good scan"
    - `folder_err_duplicate`: "Already in the list"
    - `folder_err_nested`: "Overlaps a folder already in the list"
    - `file_access_off`: "Chrome is blocking file access. Turn on \"Allow access to file URLs\" on this extension's details page."
    - `open_ext_settings`: "Open extension settings"
    - Update `setting_photog` to "Show folder name".
- [ ] Step 2: `npm run typecheck && npm run lint && npm test` (the locale test catches unused or missing keys).
- [ ] Step 3: Commit "Options: manage photo folders".

### Task 5: In-repo E2E harness

**Files:**
- Create:
  - `test/e2e/harness.mjs`: launch Chromium 1208 (`~/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`) with `--load-extension=dist`, return `{browser, extId, sw}`. Include a `setFileAccess(on)` helper that clicks `extensions-manager >>> extensions-detail-view >>> #allow-on-file-urls >>> #crToggle`, only if its `checked` state differs.
  - `test/e2e/folders.mjs`
  - `test/e2e/make-fixtures.py`: run with `python3 -I`. It writes a temporary tree:
    - `Trip/a.jpg` (400×200)
    - `Trip/Day 1/rot.jpg` (400×200 with EXIF orientation 6)
    - `Trip/x.heic` (empty bytes)
    - `Trip/x.json`
    - `Trip/.hidden/h.jpg`
    - `Other #1/b.png`
  - `test/e2e/README.md`, with how to run it
- Modify: `package.json` (`"test:e2e": "npm run build && node test/e2e/folders.mjs"`, plus a `puppeteer-core` devDependency), `.gitignore`

- [ ] Step 1: Write `folders.mjs` with numbered checks. Print `PASS`/`FAIL` per check and exit 1 if any fails.
  1. The empty hint is shown.
  2. Adding `Trip` shows `2 photos · 1 skipped`.
  3. Stored photos include `rot.jpg` with `asp` `0.500` and author `Trip / Day 1`.
  4. Adding `Trip/Day 1` gives a nested error. Adding `Trip/` gives a duplicate error.
  5. Adding a missing path gives "Folder not found".
  6. Adding `Other #1` shows `1 photos`.
  7. Removing `Other #1` deletes its record.
  8. Renaming the `Trip` folder on disk and sending `processState('all')` through the service worker keeps 2 photos and shows an error.
  9. Turning file access off shows the warning in Options, and adding a folder gives the no-access error. Turning it back on hides the warning after a focus event.
  10. Preview: the screensaver window shows an `<img>` whose `src` starts with `file://` and whose `naturalWidth` > 0.
  11. "Restore defaults" keeps the folder list.
  12. Narrow width (400px): no horizontal scroll on the sources tab.
  13. Screenshot the sources tab in light and dark to `test/e2e/out/` (git-ignored).
- [ ] Step 2: `npm run test:e2e` → all PASS.
- [ ] Step 3: Commit "Add folder E2E tests to the repo".

### Task 6: Docs and the full check

- [ ] Step 1: Update `README.md`:
  - Mark step 5 "Local photo folders: done".
  - Add a setup note: load unpacked, then turn on "Allow access to file URLs".
  - Remove the Unsplash key steps.
  - Describe the E2E command.
- [ ] Step 2: `npm run build && npm test && npm run lint && npm run test:e2e` all pass. Look at the screenshots.
- [ ] Step 3: Commit "Docs for local photo folders".
- [ ] Step 4: Ask the owner for the manual check on their installed Chrome: turning on the file access switch, and a real Google Photos download folder.
