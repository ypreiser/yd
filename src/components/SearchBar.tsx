import { useState } from "react";
import { useT } from "../lib/i18n";
import type { SearchResult } from "../lib/tauri";
import { searchYoutube } from "../lib/tauri";

interface SearchBarProps {
  onDownload: (urls: string[]) => void;
}

export default function SearchBar({ onDownload }: SearchBarProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const res = await searchYoutube(trimmed);
      setResults(res);
    } catch (err) {
      setError(t.searchError);
      console.error("search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownload(url: string) {
    onDownload([url]);
  }

  function formatDuration(d: string): string {
    if (!d) return "";
    return d;
  }

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-hidden">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length === 0}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? t.searching : t.search}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors"
            >
              <img
                src={result.thumbnail}
                alt=""
                className="w-20 h-14 rounded object-cover flex-shrink-0 bg-zinc-200 dark:bg-zinc-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {result.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {result.channel}
                  {result.duration && ` · ${formatDuration(result.duration)}`}
                </p>
              </div>
              <button
                onClick={() => handleDownload(result.url)}
                className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                {t.addToDownload}
              </button>
            </div>
          ))}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
          {t.noResults}
        </p>
      )}
    </div>
  );
}
