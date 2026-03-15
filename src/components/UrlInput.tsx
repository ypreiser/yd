import { useState, useMemo } from "react";
import { useT } from "../lib/i18n";

interface UrlInputProps {
  onSubmit: (urls: string[]) => void;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, disabled }: UrlInputProps) {
  const t = useT();
  const [text, setText] = useState("");

  function extractUrls(input: string): string[] {
    const ytRegex = /https?:\/\/(?:www\.)?(?:(?:music\.)?youtube\.com\/(?:watch\?[^\s]*v=[^\s&]+|shorts\/[^\s?]+|playlist\?[^\s]*list=[^\s&]+)|youtu\.be\/[^\s?]+)(?:\?[^\s]*)?/gi;
    const matches = input.match(ytRegex);
    if (!matches) return [];
    // dedupe while preserving order, strip tracking params
    const seen = new Set<string>();
    return matches.filter((url) => {
      const clean = url.split("&si=")[0].split("?si=")[0];
      if (seen.has(clean)) return false;
      seen.add(clean);
      return true;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = extractUrls(text);
    if (urls.length === 0) return;
    onSubmit(urls);
    setText("");
  }

  const urls = useMemo(() => extractUrls(text), [text]);
  const lineCount = urls.length;
  const isBatch = lineCount > 1;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.urlPlaceholder}
        rows={3}
        disabled={disabled}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="self-end rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isBatch ? t.downloadN(lineCount) : t.download}
      </button>
    </form>
  );
}
