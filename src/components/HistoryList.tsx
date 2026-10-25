import { useState, useEffect, useCallback } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { HistoryEntry } from "../lib/tauri";
import { historyList, historyRemove, historyClear } from "../lib/tauri";
import { useT } from "../lib/i18n";

interface HistoryListProps {
  onDownload: (urls: string[]) => void;
}

/** Local date, no time — the exact minute is noise in a list like this. */
function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

export default function HistoryList({ onDownload }: HistoryListProps) {
  const t = useT();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const load = useCallback(() => {
    historyList()
      .then(setEntries)
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function handleRemove(id: string) {
    await historyRemove(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleClear() {
    await historyClear();
    setEntries([]);
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
        {t.historyEmpty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div className="flex justify-end">
        <button
          onClick={handleClear}
          className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
        >
          {t.clearHistory}
        </button>
      </div>
      <ul className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800/30 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                {entry.title}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {formatDate(entry.completed_at)} · {entry.format.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {entry.file_path && (
                <button
                  onClick={() => revealItemInDir(entry.file_path as string)}
                  title={t.showInFolder}
                  aria-label={t.showInFolder}
                  className="text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 active:scale-[0.9] transition-all text-xs"
                >
                  📂
                </button>
              )}
              <button
                onClick={() => onDownload([entry.url])}
                title={t.redownload}
                aria-label={t.redownload}
                className="text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400 active:scale-[0.9] transition-all text-xs"
              >
                ↻
              </button>
              <button
                onClick={() => handleRemove(entry.id)}
                title={t.removeFromHistory}
                aria-label={t.removeFromHistory}
                className="text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 active:scale-[0.9] transition-all text-xs"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
