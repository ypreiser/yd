import { useState } from "react";

interface UrlInputProps {
  onSubmit: (urls: string[]) => void;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, disabled }: UrlInputProps) {
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
        placeholder={"Paste YouTube URL(s) here\nOne per line for batch download"}
        rows={3}
        disabled={disabled}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="self-end rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isBatch ? `Download ${lineCount} songs` : "Download"}
      </button>
    </form>
  );
}
