import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppConfig {
  download_dir: string;
  audio_format: string;
}

export interface DownloadProgress {
  id: string;
  url: string;
  percent: number;
  title: string | null;
  status: "queued" | "downloading" | "converting" | "done" | "error";
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

export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}
