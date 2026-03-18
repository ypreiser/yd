import type { DownloadProgress } from "../lib/tauri";
import { cancelDownload } from "../lib/tauri";
import { useT } from "../lib/i18n";

interface DownloadItemProps {
  item: DownloadProgress;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "text-zinc-400 dark:text-zinc-400",
  downloading: "text-indigo-500 dark:text-indigo-400",
  converting: "text-amber-500 dark:text-amber-400",
  done: "text-emerald-500 dark:text-emerald-400",
  cancelled: "text-zinc-400 dark:text-zinc-500",
  error: "text-red-500 dark:text-red-400",
};

const BAR_COLORS: Record<string, string> = {
  queued: "bg-zinc-400 dark:bg-zinc-600",
  downloading: "bg-indigo-500",
  converting: "bg-amber-500",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

export default function DownloadItem({ item }: DownloadItemProps) {
  const t = useT();
  const label = item.title || item.url;
  const canCancel = item.status === "downloading" || item.status === "queued";
  const isActive = item.status === "downloading" || item.status === "converting";

  const statusLabels: Record<string, string> = {
    queued: t.queued,
    downloading: t.downloading,
    converting: t.converting,
    done: t.done,
    cancelled: t.cancelled,
    error: t.error,
  };

  async function handleCancel() {
    try {
      await cancelDownload(item.id);
    } catch {
      // already finished
    }
  }

  return (
    <div
      className={`animate-fade-in rounded-lg border bg-white dark:bg-zinc-800/50 p-3 flex flex-col gap-2 transition-all ${
        isActive
          ? "border-indigo-300/50 dark:border-indigo-500/30 animate-pulse-glow"
          : "border-zinc-200 dark:border-zinc-700/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {item.status === "done" && (
            <span className="animate-check text-emerald-500 text-sm shrink-0">✓</span>
          )}
          {item.status === "error" && (
            <span className="text-red-500 text-sm shrink-0">✕</span>
          )}
          <span
            className="text-sm text-zinc-800 dark:text-zinc-200 truncate"
            title={label}
          >
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-medium ${STATUS_COLORS[item.status]}`}
          >
            {statusLabels[item.status]}
            {item.status === "downloading" && ` ${Math.round(item.percent)}%`}
          </span>
          {canCancel && (
            <button
              onClick={handleCancel}
              className="text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 active:scale-[0.9] transition-all text-xs"
              title={t.cancel}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {item.status !== "done" &&
        item.status !== "error" &&
        item.status !== "cancelled" && (
          <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 relative ${BAR_COLORS[item.status]} ${
                item.status === "downloading" ? "progress-bar-active" : ""
              }`}
              style={{ width: `${item.percent}%` }}
            />
          </div>
        )}
      {item.error && <p className="text-xs text-red-500 dark:text-red-400">{item.error}</p>}
    </div>
  );
}
