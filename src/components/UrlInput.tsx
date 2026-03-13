import { useState } from "react";
import { useT } from "../lib/i18n";

interface UrlInputProps {
  onSubmit: (urls: string[]) => void;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, disabled }: UrlInputProps) {
  const t = useT();
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = text
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) return;
    onSubmit(urls);
    setText("");
  }

  const lineCount = text.split("\n").filter((l) => l.trim().length > 0).length;
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
