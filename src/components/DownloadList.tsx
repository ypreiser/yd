import type { DownloadProgress } from "../lib/tauri";
import DownloadItem from "./DownloadItem";
import { useT } from "../lib/i18n";

interface DownloadListProps {
  items: DownloadProgress[];
  onClear?: () => void;
  onRetry?: (url: string) => void;
}

export default function DownloadList({ items, onClear, onRetry }: DownloadListProps) {
  const t = useT();

  const hasFinished = items.some(
    (i) => i.status === "done" || i.status === "already_exists" || i.status === "error" || i.status === "cancelled"
  );

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <p className="text-sm">{t.noDownloads}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
      {hasFinished && onClear && (
        <button
          onClick={onClear}
          className="self-end text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          {t.clearFinished}
        </button>
      )}
      {items.map((item) => (
        <DownloadItem key={item.id} item={item} onRetry={onRetry} />
      ))}
    </div>
  );
}
