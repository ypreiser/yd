import { useState, useEffect, useRef, useCallback } from "react";
import { useT } from "../lib/i18n";
import type { PlaylistInfo } from "../lib/tauri";

interface PlaylistModalProps {
  playlist: PlaylistInfo;
  onDownload: (urls: string[]) => void;
  onClose: () => void;
}

export default function PlaylistModal({
  playlist,
  onDownload,
  onClose,
}: PlaylistModalProps) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(playlist.entries.map((e) => e.id))
  );

  const allSelected = selected.size === playlist.entries.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(playlist.entries.map((e) => e.id)));
    }
  }

  function toggleEntry(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDownload() {
    const urls = playlist.entries
      .filter((e) => selected.has(e.id))
      .map((e) => e.url);
    onDownload(urls);
    onClose();
  }

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    // Focus the first focusable element inside the dialog
    const el = dialogRef.current;
    if (el) {
      const first = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }
    return () => {
      previousFocus.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playlist-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div ref={dialogRef} className="animate-slide-up w-full max-w-lg mx-4 max-h-[80vh] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="min-w-0">
            <h2 id="playlist-modal-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {playlist.title || t.playlist}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t.playlistVideos(playlist.entries.length)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors text-lg px-1"
          >
            ✕
          </button>
        </div>

        {/* Select all bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500"
            />
            {allSelected ? t.deselectAll : t.selectAll}
          </label>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {selected.size}/{playlist.entries.length}
          </span>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {playlist.entries.map((entry) => (
            <label
              key={entry.id}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(entry.id)}
                onChange={() => toggleEntry(entry.id)}
                className="rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <img
                src={entry.thumbnail}
                alt=""
                className="w-16 h-11 rounded object-cover shrink-0 bg-zinc-200 dark:bg-zinc-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {entry.title}
                </p>
                {entry.duration && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.duration}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97] transition-all"
          >
            {t.close}
          </button>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {t.downloadSelected(selected.size)}
          </button>
        </div>
      </div>
    </div>
  );
}
