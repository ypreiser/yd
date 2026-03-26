/**
 * Vitest setup file — mocks the Tauri IPC bridge so components can be tested
 * outside of a real Tauri runtime.
 */
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Default mock config returned by get_config
export const DEFAULT_CONFIG = {
  download_dir: "C:\\Users\\test\\Downloads",
  audio_format: "m4a",
  theme: "dark" as const,
  language: "en" as const,
  auto_update: false,
  embed_title: false,
  embed_thumbnail: false,
  flip_hebrew_in_title: false,
};

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, _args?: unknown) => {
    switch (cmd) {
      case "get_config":
        return { ...DEFAULT_CONFIG };
      case "set_config":
        return undefined;
      case "download":
        return "mock-download-id";
      case "download_batch":
        return ["mock-id-1"];
      case "cancel_download":
        return undefined;
      case "search_youtube":
        return [];
      case "fetch_playlist":
        return { title: "Mock Playlist", entries: [] };
      case "get_ytdlp_version":
        return "2024.12.01";
      case "check_ytdlp_update":
        return { current: "2024.12.01", latest: "2024.12.01", update_available: false };
      case "update_ytdlp":
        return "2024.12.01";
      case "check_binaries":
        return [];
      case "check_disk_space":
        return 10 * 1024 * 1024 * 1024; // 10 GB
      case "cancel_search":
        return undefined;
      default:
        throw new Error(`Unmocked invoke command: ${cmd}`);
    }
  }),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()), // returns unlisten fn
  emit: vi.fn(async () => undefined),
}));

// Mock @tauri-apps/api/app
vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(async () => "1.2.1"),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => "C:\\Users\\test\\Downloads\\chosen"),
}));

// Mock @tauri-apps/plugin-opener
vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(async () => undefined),
}));

// Mock @tauri-apps/plugin-process
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(async () => undefined),
}));

// Mock @tauri-apps/plugin-updater
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(async () => null),
}));

// Silence console.error in tests unless explicitly needed
vi.spyOn(console, "error").mockImplementation(() => undefined);
