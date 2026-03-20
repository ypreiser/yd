import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppConfig {
  download_dir: string;
  audio_format: string;
  theme: "dark" | "light";
  language: "en" | "he";
  auto_update: boolean;
}

export interface DownloadProgress {
  id: string;
  url: string;
  percent: number;
  title: string | null;
  status: "queued" | "downloading" | "converting" | "done" | "cancelled" | "error";
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

export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}
