import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppConfig {
  download_dir: string;
  audio_format: string;
  theme: "dark" | "light";
  language: "en" | "he";
  auto_update: boolean;
  embed_title: boolean;
  embed_thumbnail: boolean;
  flip_hebrew_in_title: boolean;
  /** How cookies reach yt-dlp — needed for YouTube's "not a bot" check. */
  cookies_mode: CookiesMode;
  /** Browser to read cookies from when cookies_mode === "browser". */
  cookies_browser: string;
  /** Absolute path to a cookies.txt when cookies_mode === "file". */
  cookies_file: string;
}

export type CookiesMode = "none" | "browser" | "file";

/** Browsers the Rust side accepts for --cookies-from-browser. */
export const COOKIE_BROWSERS = [
  "firefox",
  "chrome",
  "chromium",
  "edge",
  "brave",
  "opera",
  "vivaldi",
  "safari",
  "whale",
] as const;

export interface DownloadProgress {
  id: string;
  url: string;
  percent: number;
  title: string | null;
  status: "queued" | "downloading" | "converting" | "done" | "cancelled" | "error" | "already_exists";
  error: string | null;
}

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function setConfig(config: AppConfig): Promise<void> {
  return invoke("set_config", { config });
}

export async function download(url: string): Promise<string> {
  return invoke("download", { url });
}

export async function downloadBatch(urls: string[]): Promise<string[]> {
  return invoke("download_batch", { urls });
}

export async function cancelDownload(id: string): Promise<void> {
  return invoke("cancel_download", { id });
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  duration: string;
  channel: string;
  thumbnail: string;
}

export async function searchYoutube(query: string): Promise<SearchResult[]> {
  return invoke("search_youtube", { query });
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
}

export interface PlaylistInfo {
  title: string;
  entries: PlaylistEntry[];
}

export async function fetchPlaylist(url: string): Promise<PlaylistInfo> {
  return invoke("fetch_playlist", { url });
}

export async function getYtdlpVersion(): Promise<string> {
  return invoke("get_ytdlp_version");
}

export interface YtdlpUpdateInfo {
  current: string;
  latest: string;
  update_available: boolean;
}

export async function checkYtdlpUpdate(): Promise<YtdlpUpdateInfo> {
  return invoke("check_ytdlp_update");
}

export async function updateYtdlp(): Promise<string> {
  return invoke("update_ytdlp");
}

export async function checkBinaries(): Promise<string[]> {
  return invoke("check_binaries");
}

export async function checkDiskSpace(path: string): Promise<number> {
  return invoke("check_disk_space", { path });
}

export async function cancelSearch(): Promise<void> {
  return invoke("cancel_search");
}

export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}

// --- connectivity ---

export interface Connectivity {
  /** Some host on the internet answered. */
  online: boolean;
  /** YouTube itself answered. */
  youtube: boolean;
}

export async function checkConnectivity(): Promise<Connectivity> {
  return invoke("check_connectivity");
}

// --- error log / problem reports ---

export interface LogInfo {
  path: string;
  entries: number;
}

/** Record a frontend failure in the local (redacted) error log. */
export async function logAppError(
  context: string,
  message: string
): Promise<void> {
  return invoke("log_app_error", { context, message });
}

export async function errorLogInfo(): Promise<LogInfo> {
  return invoke("error_log_info");
}

export async function clearErrorLog(): Promise<void> {
  return invoke("clear_error_log");
}

/** Build the report text shown to the user before anything is shared. */
export async function buildErrorReport(
  ytdlpVersion?: string
): Promise<string> {
  return invoke("build_error_report", { ytdlpVersion: ytdlpVersion ?? null });
}
