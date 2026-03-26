/**
 * Tests for the URL extraction logic that lives inside UrlInput.
 * We replicate the exact regex and deduplication logic here so it can be
 * unit-tested without rendering the component.
 */
import { describe, it, expect } from "vitest";

// Mirrors the extractUrls helper inside UrlInput.tsx
function extractUrls(input: string): string[] {
  const ytRegex =
    /https:\/\/(?:www\.)?(?:(?:music\.)?youtube\.com\/(?:watch\?[^\s]+|shorts\/[^\s?]+|playlist\?[^\s]+|(?:channel|c)\/[^\s?]+|@[^\s?/]+(?:\/[^\s?]*)?)|youtu\.be\/[^\s?]+)(?:\?[^\s]*)?/gi;
  const matches = input.match(ytRegex);
  if (!matches) return [];
  const seen = new Set<string>();
  return matches.filter((url) => {
    const clean = url.split("&si=")[0].split("?si=")[0];
    if (seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

describe("extractUrls", () => {
  it("extracts a plain watch URL", () => {
    const urls = extractUrls("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("dQw4w9WgXcQ");
  });

  it("extracts a youtu.be short URL", () => {
    const urls = extractUrls("check this out: https://youtu.be/dQw4w9WgXcQ");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("youtu.be/dQw4w9WgXcQ");
  });

  it("extracts multiple URLs from mixed text", () => {
    const text = `
      First song: https://www.youtube.com/watch?v=abc123
      Second song https://youtu.be/xyz789 enjoy!
    `;
    const urls = extractUrls(text);
    expect(urls).toHaveLength(2);
  });

  it("deduplicates identical URLs", () => {
    const text =
      "https://www.youtube.com/watch?v=abc https://www.youtube.com/watch?v=abc";
    const urls = extractUrls(text);
    expect(urls).toHaveLength(1);
  });

  it("strips &si= tracking param when deduplicating", () => {
    const text =
      "https://www.youtube.com/watch?v=abc&si=tracker https://www.youtube.com/watch?v=abc&si=other";
    const urls = extractUrls(text);
    expect(urls).toHaveLength(1);
  });

  it("strips ?si= tracking param when deduplicating", () => {
    const text =
      "https://youtu.be/abc?si=tracker https://youtu.be/abc?si=other";
    const urls = extractUrls(text);
    expect(urls).toHaveLength(1);
  });

  it("returns empty array for no URLs", () => {
    expect(extractUrls("hello world no links here")).toHaveLength(0);
  });

  it("returns empty array for empty string", () => {
    expect(extractUrls("")).toHaveLength(0);
  });

  it("extracts YouTube Music URL", () => {
    const urls = extractUrls("https://music.youtube.com/watch?v=abc123&list=RDAMVM");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("music.youtube.com");
  });

  it("extracts playlist URL", () => {
    const urls = extractUrls("https://www.youtube.com/playlist?list=PLxyz123");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("list=PLxyz123");
  });

  it("extracts YouTube Shorts URL", () => {
    const urls = extractUrls("https://www.youtube.com/shorts/abc123");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("shorts/abc123");
  });

  it("extracts @ channel URL", () => {
    const urls = extractUrls("https://www.youtube.com/@SomeArtist");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("@SomeArtist");
  });

  it("does not extract non-YouTube HTTPS URLs", () => {
    expect(extractUrls("https://example.com/video")).toHaveLength(0);
    expect(extractUrls("https://vimeo.com/123456")).toHaveLength(0);
  });

  it("does not extract HTTP (non-HTTPS) YouTube URLs", () => {
    expect(extractUrls("http://www.youtube.com/watch?v=abc")).toHaveLength(0);
  });

  it("handles 10 unique URLs", () => {
    const urls = Array.from(
      { length: 10 },
      (_, i) => `https://www.youtube.com/watch?v=vid${i.toString().padStart(4, "0")}`
    ).join("\n");
    expect(extractUrls(urls)).toHaveLength(10);
  });
});
