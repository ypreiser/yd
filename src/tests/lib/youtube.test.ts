import { describe, it, expect } from "vitest";
import { isPlaylistUrl } from "../../lib/youtube";

describe("isPlaylistUrl", () => {
  it("detects list= param", () => {
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=abc&list=PLxyz")).toBe(true);
  });

  it("detects list= as first param", () => {
    expect(isPlaylistUrl("https://www.youtube.com/playlist?list=PLxyz")).toBe(true);
  });

  it("detects channel URL", () => {
    expect(isPlaylistUrl("https://www.youtube.com/channel/UCxyz")).toBe(true);
  });

  it("detects /c/ URL", () => {
    expect(isPlaylistUrl("https://www.youtube.com/c/SomeChannel")).toBe(true);
  });

  it("detects @ handle URL", () => {
    expect(isPlaylistUrl("https://www.youtube.com/@SomeHandle")).toBe(true);
  });

  it("returns false for plain watch URL", () => {
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });

  it("returns false for youtu.be short URL", () => {
    expect(isPlaylistUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPlaylistUrl("")).toBe(false);
  });
});
