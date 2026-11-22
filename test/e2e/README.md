# Browser tests

`npm run test:e2e` builds the extension and runs `folders.mjs` in Chromium
with `dist/` loaded unpacked. It covers:

- the Options folder list
- folder scanning in the service worker
- Chrome's "Allow access to file URLs" switch
- the screensaver showing a local photo

Each check prints `PASS` or `FAIL`. The script exits with 1 if any check
fails. Screenshots go to `test/e2e/out/`, which git ignores.

Requirements:

- **A Chromium build.** Branded Chrome ignores `--load-extension`. The harness
  uses Playwright's Chromium from `~/.cache/ms-playwright`; install it with
  `npx playwright install chromium`. Set `CHROMIUM=/path/to/chrome` to use
  another build.
- **A short temp path.** Each run writes a temporary photo tree under the OS
  temp folder. Chromium fails to start if `TMPDIR` is a very long path.

Set `E2E_DEBUG=1` to print stack traces and Chromium's own output.

The fixture images in `fixtures/` are:

- `wide.jpg`: 400×200
- `rotated.jpg`: 400×200 with EXIF orientation 6, so it displays as 200×400
- `square.png`: 300×300
