/**
 * Shared helpers for WebdriverIO e2e tests.
 *
 * These target the built Tauri app window. The app must be running via
 * `npm run tauri dev` or a built binary before running e2e tests.
 */
import type { Browser } from "webdriverio";

export const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
export const PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI";

/**
 * Wait for an element matching the selector to appear and return it.
 */
export async function waitForEl(
  browser: Browser,
  selector: string,
  timeout = 10_000
) {
  const el = await browser.$(selector);
  await el.waitForExist({ timeout });
  return el;
}

/**
 * Clear and type into an element.
 */
export async function clearAndType(
  browser: Browser,
  selector: string,
  text: string
) {
  const el = await waitForEl(browser, selector);
  await el.clearValue();
  await el.setValue(text);
  return el;
}

/**
 * Wait for the download status text to appear for any item.
 */
export async function waitForDownloadStatus(
  browser: Browser,
  status: "Queued" | "Downloading" | "Converting" | "Done" | "Cancelled" | "Error" | "Already exists",
  timeout = 60_000
) {
  await browser.waitUntil(
    async () => {
      const els = await browser.$$("*=".concat(status));
      return els.length > 0;
    },
    { timeout, timeoutMsg: `Expected status "${status}" not found within ${timeout}ms` }
  );
}

/**
 * Get the textarea in the URL input area.
 */
export async function getUrlTextarea(browser: Browser) {
  return browser.$("textarea");
}

/**
 * Submit the URL input form.
 */
export async function submitUrl(browser: Browser, url: string) {
  const textarea = await getUrlTextarea(browser);
  await textarea.clearValue();
  await textarea.setValue(url);
  const submitBtn = await browser.$("button=Download");
  await submitBtn.click();
}
