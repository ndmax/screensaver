/**
 * Launch Chromium with the built extension (dist/) loaded.
 *
 * Branded Chrome ignores --load-extension, so this uses Playwright's
 * Chromium build. Set CHROMIUM to another Chromium binary to override.
 */

import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import puppeteer from 'puppeteer-core';

export const DIST = resolve(import.meta.dirname, '../../dist');

function findChromium() {
  if (process.env.CHROMIUM) {
    return process.env.CHROMIUM;
  }
  const base = join(homedir(), '.cache/ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    const bin = join(base, d, 'chrome-linux64/chrome');
    if (existsSync(bin)) {
      return bin;
    }
  }
  throw new Error('Chromium not found: run `npx playwright install chromium` or set CHROMIUM');
}

/** Wait for the extension's service worker and return it with the extension id */
export async function getWorker(browser) {
  const target = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'), {timeout: 15000});
  return {extId: new URL(target.url()).host, sw: await target.worker()};
}

export async function launch({viewport = {width: 1280, height: 900}} = {}) {
  const browser = await puppeteer.launch({
    executablePath: findChromium(),
    headless: true,
    pipe: true,
    enableExtensions: true,
    dumpio: !!process.env.E2E_DEBUG,
    defaultViewport: viewport,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-sandbox'],
  });
  return {browser, ...await getWorker(browser)};
}

/**
 * Turn the extension's "Allow access to file URLs" switch on or off.
 * Chrome reloads the extension when it changes, so this waits for the new
 * service worker and returns it.
 */
export async function setFileAccess(browser, extId, on) {
  const page = await browser.newPage();
  await page.goto(`chrome://extensions/?id=${extId}`);
  const toggle = await page.waitForSelector(
      'extensions-manager >>> extensions-detail-view >>> #allow-on-file-urls >>> #crToggle', {timeout: 10000});
  const checked = await toggle.evaluate((el) => el.checked);
  let sw = null;
  if (checked !== on) {
    const isSw = (t) => t.type() === 'service_worker' && t.url().includes(extId);
    const old = browser.targets().filter(isSw);
    await toggle.click();
    const fresh = await browser.waitForTarget((t) => isSw(t) && !old.includes(t), {timeout: 15000});
    sw = await fresh.worker();
  }
  await page.close().catch(() => {});
  return sw;
}

/** Poll until fn() returns a truthy value */
export async function waitFor(fn, timeout = 10000, interval = 100) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) {
        return last;
      }
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`timed out waiting (last: ${last instanceof Error ? last.message : JSON.stringify(last)})`);
}

/** A tiny check runner: numbered PASS/FAIL lines, exit code 1 on any failure */
export function checker() {
  let n = 0;
  let failed = 0;
  return {
    async check(name, fn) {
      n++;
      try {
        await fn();
        console.log(`PASS ${n}. ${name}`);
      } catch (err) {
        failed++;
        console.log(`FAIL ${n}. ${name}: ${err instanceof Error ? err.message : String(err)}`);
        if (process.env.E2E_DEBUG && err instanceof Error) {
          console.log(err.stack);
        }
      }
    },
    done() {
      console.log(`\n${n - failed}/${n} passed`);
      process.exitCode = failed ? 1 : 0;
    },
  };
}

export function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}
