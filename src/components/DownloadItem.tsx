import type { DownloadProgress } from "../lib/tauri";
import { cancelDownload } from "../lib/tauri";

interface DownloadItemProps {
  item: DownloadProgress;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  downloading: "Downloading",
  converting: "Converting",
  done: "Done",
  cancelled: "Cancelled",
  error: "Error",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "text-zinc-400",
  downloading: "text-indigo-400",
  converting: "text-amber-400",
  done: "text-emerald-400",
  cancelled: "text-zinc-500",
  error: "text-red-400",
};

const BAR_COLORS: Record<string, string> = {
  queued: "bg-zinc-600",
  downloading: "bg-indigo-500",
  converting: "bg-amber-500",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

export default function DownloadItem({ item }: DownloadItemProps) {
  const label = item.title || item.url;
  const canCancel = item.status === "downloading" || item.status === "queued";

  async function handleCancel() {
    try {
      await cancelDownload(item.id);
    } catch {
      // already finished
    }
  }

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-200 truncate flex-1" title={label}>
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium ${STATUS_COLORS[item.status]}`}>
            {STATUS_LABELS[item.status]}
            {item.status === "downloading" && ` ${Math.round(item.percent)}%`}
          </span>
          {canCancel && (
            <button
              onClick={handleCancel}
              className="text-zinc-500 hover:text-red-400 transition-colors text-xs"
              title="Cancel"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {item.status !== "done" && item.status !== "error" && item.status !== "cancelled" && (
        <div className="h-1.5 w-full rounded-full bg-zinc-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${BAR_COLORS[item.status]}`}
            style={{ width: `${item.percent}%` }}
          />
        </div>
      )}
      {item.error && (
        <p className="text-xs text-red-400">{item.error}</p>
      )}
    </div>
  );
}
