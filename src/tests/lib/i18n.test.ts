import { describe, it, expect } from "vitest";
import { getTranslations, isRTL } from "../../lib/i18n";

describe("getTranslations", () => {
  it("returns English translations", () => {
    const t = getTranslations("en");
    expect(t.appTitle).toBe("YD");
    expect(t.settings).toBe("Settings");
    expect(t.download).toBe("Download");
    expect(t.noDownloads).toBe("No downloads yet");
  });

  it("returns Hebrew translations", () => {
    const t = getTranslations("he");
    expect(t.appTitle).toBe("YD");
    expect(t.settings).toBe("הגדרות");
    expect(t.download).toBe("הורדה");
  });

  it("falls back to English for unknown locale", () => {
    // @ts-expect-error intentional bad value
    const t = getTranslations("fr");
    expect(t.appTitle).toBe("YD");
  });

  it("downloadN produces correct English string", () => {
    const t = getTranslations("en");
    expect(t.downloadN(3)).toBe("Download 3 songs");
  });

  it("downloadN produces correct Hebrew string", () => {
    const t = getTranslations("he");
    expect(t.downloadN(5)).toBe("הורד 5 שירים");
  });

  it("playlistVideos works in both languages", () => {
    expect(getTranslations("en").playlistVideos(10)).toBe("10 videos");
    expect(getTranslations("he").playlistVideos(10)).toBe("10 סרטונים");
  });

  it("downloadSelected works", () => {
    expect(getTranslations("en").downloadSelected(4)).toBe("Download 4 selected");
    expect(getTranslations("he").downloadSelected(4)).toBe("הורד 4 נבחרים");
  });

  it("ytdlpUpdateAvailable interpolates version", () => {
    expect(getTranslations("en").ytdlpUpdateAvailable("2024.12.01")).toBe(
      "Update available: 2024.12.01"
    );
  });

  it("missingBinaries interpolates binary list", () => {
    expect(getTranslations("en").missingBinaries("yt-dlp, ffmpeg")).toContain("yt-dlp, ffmpeg");
  });
});

describe("isRTL", () => {
  it("returns true for Hebrew", () => {
    expect(isRTL("he")).toBe(true);
  });

  it("returns false for English", () => {
    expect(isRTL("en")).toBe(false);
  });
});
