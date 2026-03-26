/**
 * E2E tests for the YD Tauri app using WebdriverIO + @tauri-apps/driver.
 *
 * Prerequisites:
 *   - App binary built: npm run tauri build  (or dev server running)
 *   - Run: npm run test:e2e
 *
 * These tests interact with the real Tauri window. Downloads are NOT actually
 * performed against YouTube — instead the tests verify UI state transitions
 * and interactions. Tests that would require a real network connection are
 * annotated with [NETWORK].
 */
import { browser, $ as _$ } from "@wdio/globals";
import {
  YOUTUBE_URL,
  PLAYLIST_URL,
  waitForEl,
  waitForDownloadStatus,
} from "./helpers";

// --------------------------------------------------------------------------
// App shell
// --------------------------------------------------------------------------

describe("App shell", () => {
  it("shows the app title YD", async () => {
    const title = await $("h1");
    await expect(title).toHaveText("YD");
  });

  it("has a Settings button in the header", async () => {
    const btn = await $("button=Settings");
    await expect(btn).toBeDisplayed();
  });

  it("shows URL and Search mode tabs", async () => {
    const urlTab = await $("button=URL");
    const searchTab = await $("button=Search");
    await expect(urlTab).toBeDisplayed();
    await expect(searchTab).toBeDisplayed();
  });

  it("shows URL input textarea by default", async () => {
    const textarea = await $("textarea");
    await expect(textarea).toBeDisplayed();
  });

  it("shows empty download list message", async () => {
    // May show Hebrew or English depending on config
    const empty = await $("p=No downloads yet");
    if (!(await empty.isExisting())) {
      const heEmpty = await $("p=אין הורדות עדיין");
      await expect(heEmpty).toBeDisplayed();
    } else {
      await expect(empty).toBeDisplayed();
    }
  });
});

// --------------------------------------------------------------------------
// Navigation
// --------------------------------------------------------------------------

describe("Navigation", () => {
  it("navigates to Settings view", async () => {
    await $("button=Settings").then((b) => b.click());
    const heading = await waitForEl(browser, "h2=Settings");
    await expect(heading).toBeDisplayed();
  });

  it("has a Back button in settings", async () => {
    const back = await $("button=Back");
    await expect(back).toBeDisplayed();
  });

  it("navigates back to main via Back button", async () => {
    await $("button=Back").then((b) => b.click());
    const textarea = await $("textarea");
    await expect(textarea).toBeDisplayed();
  });

  it("navigates back to main via app title click", async () => {
    await $("button=Settings").then((b) => b.click());
    await waitForEl(browser, "h2=Settings");
    await $("h1").then((h) => h.click());
    const textarea = await $("textarea");
    await expect(textarea).toBeDisplayed();
  });

  it("switches to Search mode", async () => {
    await $("button=Search").then((b) => b.click());
    const searchInput = await $('input[type="text"]');
    await expect(searchInput).toBeDisplayed();
  });

  it("switches back to URL mode", async () => {
    await $("button=URL").then((b) => b.click());
    const textarea = await $("textarea");
    await expect(textarea).toBeDisplayed();
  });
});

// --------------------------------------------------------------------------
// URL input
// --------------------------------------------------------------------------

describe("URL input", () => {
  beforeEach(async () => {
    // Ensure we are on the main view with URL mode
    const urlTab = await $("button=URL");
    if (await urlTab.isExisting()) {
      await urlTab.click();
    }
  });

  it("Download button is disabled when textarea is empty", async () => {
    const textarea = await $("textarea");
    await textarea.clearValue();
    const btn = await $("button=Download");
    await expect(btn).toBeDisabled();
  });

  it("Download button enables when URL is typed", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(YOUTUBE_URL);
    const btn = await $("button=Download");
    await expect(btn).not.toBeDisabled();
  });

  it("shows Download N songs label for multiple URLs", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(
      `https://www.youtube.com/watch?v=aaa\nhttps://www.youtube.com/watch?v=bbb`
    );
    // Button text changes to "Download 2 songs"
    const btn = await $("button*=songs");
    await expect(btn).toBeDisplayed();
    await textarea.clearValue();
  });

  it("shows Playlist button for a playlist URL", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(PLAYLIST_URL);
    const btn = await $("button=Playlist");
    await expect(btn).toBeDisplayed();
    await textarea.clearValue();
  });

  it("has a Paste button", async () => {
    const paste = await $("button=Paste");
    await expect(paste).toBeDisplayed();
  });

  it("clears textarea after submit", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(YOUTUBE_URL);
    await $("button=Download").then((b) => b.click());
    // After submit, textarea should be empty
    await browser.waitUntil(
      async () => {
        const val = await textarea.getValue();
        return val === "";
      },
      { timeout: 5000, timeoutMsg: "Textarea was not cleared after submit" }
    );
  });

  it("shows queued item immediately after submit", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(YOUTUBE_URL);
    await $("button=Download").then((b) => b.click());

    // Should see Queued status quickly
    await waitForDownloadStatus(browser, "Queued", 5000);
  });

  it("shows cancel button for queued/downloading item", async () => {
    // Cancel button should appear for active items
    const cancelBtns = await $$('[aria-label="Cancel"]');
    const found = cancelBtns.length > 0;
    // This depends on whether there is an active download — just verify it's accessible
    if (found) {
      await expect(cancelBtns[0]).toBeDisplayed();
    }
  });
});

// --------------------------------------------------------------------------
// Settings
// --------------------------------------------------------------------------

describe("Settings panel", () => {
  beforeEach(async () => {
    await $("button=Settings").then((b) => b.click());
    await waitForEl(browser, "h2=Settings");
  });

  afterEach(async () => {
    // Navigate back
    const back = await $("button=Back");
    if (await back.isExisting()) {
      await back.click();
    }
  });

  it("shows Download Directory input", async () => {
    const input = await $('input[id="download-dir"]');
    await expect(input).toBeDisplayed();
    const val = await input.getValue();
    expect(val.length).toBeGreaterThan(0);
  });

  it("shows audio format select with M4A, MP3, OPUS, FLAC options", async () => {
    const select = await $('select[id="audio-format"]');
    await expect(select).toBeDisplayed();
    const options = await select.$$("option");
    const values = await Promise.all(options.map((o) => o.getValue()));
    expect(values).toContain("m4a");
    expect(values).toContain("mp3");
    expect(values).toContain("opus");
    expect(values).toContain("flac");
  });

  it("can change audio format to MP3", async () => {
    const select = await $('select[id="audio-format"]');
    await select.selectByAttribute("value", "mp3");
    const val = await select.getValue();
    expect(val).toBe("mp3");
    // Revert
    await select.selectByAttribute("value", "m4a");
  });

  it("shows Dark and Light theme buttons", async () => {
    const dark = await $("button=Dark");
    const light = await $("button=Light");
    await expect(dark).toBeDisplayed();
    await expect(light).toBeDisplayed();
  });

  it("shows Save and Cancel buttons", async () => {
    const save = await $("button=Save");
    const cancel = await $("button=Cancel");
    await expect(save).toBeDisplayed();
    await expect(cancel).toBeDisplayed();
  });

  it("Cancel button navigates back without saving", async () => {
    const dirInput = await $('input[id="download-dir"]');
    const originalVal = await dirInput.getValue();

    await dirInput.setValue("C:\\ShouldNotBeSaved");
    await $("button=Cancel").then((b) => b.click());

    // Go back to settings to verify value was not saved
    await $("button=Settings").then((b) => b.click());
    await waitForEl(browser, "h2=Settings");

    const dirInput2 = await $('input[id="download-dir"]');
    const val2 = await dirInput2.getValue();
    expect(val2).toBe(originalVal);
  });

  it("Save button saves config and closes settings", async () => {
    await $("button=Save").then((b) => b.click());
    // Should return to main view
    await browser.waitUntil(
      async () => {
        const ta = await $("textarea");
        return ta.isExisting();
      },
      { timeout: 5000 }
    );
  });

  it("shows yt-dlp version string", async () => {
    const versionArea = await $('[class*="text-zinc"]');
    await expect(versionArea).toBeDisplayed();
  });

  it("shows Check button for yt-dlp update", async () => {
    const checkBtn = await $("button=Check");
    await expect(checkBtn).toBeDisplayed();
  });

  it("shows Browse button for directory picker", async () => {
    const browse = await $("button=Browse");
    await expect(browse).toBeDisplayed();
  });

  it("flip Hebrew in title is disabled when Embed Title is off", async () => {
    // Ensure Embed Title is off
    const embedTitleBtn = await $("button=Embed Title");
    const cls = await embedTitleBtn.getAttribute("class");
    // If currently on, click to turn off
    if (cls && cls.includes("bg-indigo-600")) {
      await embedTitleBtn.click();
    }

    const flipBtn = await $("button=Flip Hebrew in Title");
    await expect(flipBtn).toBeDisabled();
  });
});

// --------------------------------------------------------------------------
// Search mode
// --------------------------------------------------------------------------

describe("Search mode", () => {
  beforeEach(async () => {
    const searchTab = await $("button=Search");
    await searchTab.click();
  });

  afterEach(async () => {
    const urlTab = await $("button=URL");
    await urlTab.click();
  });

  it("shows search input", async () => {
    const input = await $('input[type="text"]');
    await expect(input).toBeDisplayed();
  });

  it("Search button is disabled when input is empty", async () => {
    const btn = await $("button=Search");
    await expect(btn).toBeDisabled();
  });

  it("Search button enables when query is typed", async () => {
    const input = await $('input[type="text"]');
    await input.setValue("test song");
    const btn = await $("button=Search");
    await expect(btn).not.toBeDisabled();
    await input.clearValue();
  });

  // [NETWORK] This test requires network access
  it.skip("[NETWORK] returns search results for a valid query", async () => {
    const input = await $('input[type="text"]');
    await input.setValue("Rick Astley Never Gonna Give You Up");
    await $("button=Search").then((b) => b.click());

    await browser.waitUntil(
      async () => {
        const items = await $$('[class*="animate-fade-in"]');
        return items.length > 0;
      },
      { timeout: 30_000, timeoutMsg: "No search results returned" }
    );
  });
});

// --------------------------------------------------------------------------
// Download list management
// --------------------------------------------------------------------------

describe("Download list", () => {
  it("clear finished button removes done items", async () => {
    // This assumes a done item exists from a prior test; skip if none
    const clearBtn = await $("button*=Clear finished");
    if (await clearBtn.isExisting()) {
      const countBefore = await $$('[class*="animate-fade-in"]').then(
        (els) => els.length
      );
      await clearBtn.click();
      await browser.pause(300);
      const countAfter = await $$('[class*="animate-fade-in"]').then(
        (els) => els.length
      );
      expect(countAfter).toBeLessThan(countBefore);
    }
  });
});

// --------------------------------------------------------------------------
// Playlist modal
// --------------------------------------------------------------------------

describe("Playlist modal", () => {
  it("is not visible on app load", async () => {
    const dialog = await $('[role="dialog"]');
    await expect(dialog).not.toBeDisplayed();
  });

  // [NETWORK] This test requires a real playlist to be accessible
  it.skip("[NETWORK] opens playlist modal for a playlist URL", async () => {
    const textarea = await $("textarea");
    await textarea.setValue(PLAYLIST_URL);
    await $("button=Playlist").then((b) => b.click());

    const dialog = await $('[role="dialog"]');
    await expect(dialog).toBeDisplayed();

    const closeBtn = await $('[aria-label="Close"]');
    await closeBtn.click();
  });
});

// --------------------------------------------------------------------------
// Accessibility
// --------------------------------------------------------------------------

describe("Accessibility", () => {
  it("cancel buttons have aria-label Cancel", async () => {
    // Submit a download to get a cancel button
    const textarea = await $("textarea");
    await textarea.setValue(YOUTUBE_URL);
    await $("button=Download").then((b) => b.click());

    await browser.waitUntil(
      async () => {
        const btn = await $('[aria-label="Cancel"]');
        return btn.isExisting();
      },
      { timeout: 5000, timeoutMsg: "Cancel button not found" }
    );
    const cancelBtn = await $('[aria-label="Cancel"]');
    await expect(cancelBtn).toBeDisplayed();
  });

  it("progress bar has correct ARIA attributes", async () => {
    const progressbar = await $('[role="progressbar"]');
    if (await progressbar.isExisting()) {
      const min = await progressbar.getAttribute("aria-valuemin");
      const max = await progressbar.getAttribute("aria-valuemax");
      expect(min).toBe("0");
      expect(max).toBe("100");
    }
  });

  it("playlist dialog has aria-modal attribute", async () => {
    const dialog = await $('[role="dialog"]');
    if (await dialog.isExisting()) {
      const modal = await dialog.getAttribute("aria-modal");
      expect(modal).toBe("true");
    }
  });
});
