import { useState, useMemo } from "react";
import { useT } from "../lib/i18n";
import type { PlaylistInfo } from "../lib/tauri";
import { fetchPlaylist } from "../lib/tauri";
import PlaylistModal from "./PlaylistModal";

interface UrlInputProps {
  onSubmit: (urls: string[]) => void;
  disabled?: boolean;
}

function isPlaylistUrl(url: string): boolean {
  return /[?&]list=/.test(url) || /\/playlist\?/.test(url)
    || /\/(channel|c|@)[/\w]/.test(url);
}

export default function UrlInput({ onSubmit, disabled }: UrlInputProps) {
  const t = useT();
  const [text, setText] = useState("");
  const [playlistData, setPlaylistData] = useState<PlaylistInfo | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [pendingPlaylists, setPendingPlaylists] = useState<string[]>([]);

  function extractUrls(input: string): string[] {
    const ytRegex = /https?:\/\/(?:www\.)?(?:(?:music\.)?youtube\.com\/(?:watch\?[^\s]+|shorts\/[^\s?]+|playlist\?[^\s]+|(?:channel|c)\/[^\s?]+|@[^\s?/]+(?:\/[^\s?]*)?)|youtu\.be\/[^\s?]+)(?:\?[^\s]*)?/gi;
    const matches = input.match(ytRegex);
    if (!matches) return [];
    const seen = new Set<string>();
    return matches.filter((url) => {
      const clean = url.split("&si=")[0].split("?si=")[0];
      if (seen.has(clean)) return false;
      seen.add(clean);
      return true;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = extractUrls(text);
    if (urls.length === 0) return;

    const nonPlaylistUrls = urls.filter((u) => !isPlaylistUrl(u));
    const playlistUrls = urls.filter(isPlaylistUrl);

    // Download non-playlist URLs immediately
    if (nonPlaylistUrls.length > 0) {
      onSubmit(nonPlaylistUrls);
    }

    // Fetch first playlist and show modal (one at a time)
    if (playlistUrls.length > 0) {
      setPendingPlaylists(playlistUrls.slice(1));
      setPlaylistLoading(true);
      setPlaylistError(null);
      try {
        const info = await fetchPlaylist(playlistUrls[0]);
        setPlaylistData(info);
      } catch {
        setPlaylistError(t.playlistError);
      } finally {
        setPlaylistLoading(false);
      }
    }

    setText("");
  }

  async function handlePlaylistClose() {
    setPlaylistData(null);
    // Show next pending playlist if any
    if (pendingPlaylists.length > 0) {
      const next = pendingPlaylists[0];
      setPendingPlaylists(pendingPlaylists.slice(1));
      setPlaylistLoading(true);
      setPlaylistError(null);
      try {
        const info = await fetchPlaylist(next);
        setPlaylistData(info);
      } catch {
        setPlaylistError(t.playlistError);
      } finally {
        setPlaylistLoading(false);
      }
    }
  }

  function handlePlaylistDownload(urls: string[]) {
    onSubmit(urls);
    handlePlaylistClose();
  }

  const urls = useMemo(() => extractUrls(text), [text]);
  const lineCount = urls.length;
  const isBatch = lineCount > 1;
  const hasPlaylist = urls.some(isPlaylistUrl);

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.urlPlaceholder}
          rows={3}
          disabled={disabled || playlistLoading}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
        />
        {playlistError && (
          <p className="text-sm text-red-500">{playlistError}</p>
        )}
        <button
          type="submit"
          disabled={disabled || playlistLoading || text.trim().length === 0}
          className="self-end rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {playlistLoading
            ? t.loadingPlaylist
            : hasPlaylist && lineCount === 1
              ? t.playlist
              : isBatch
                ? t.downloadN(lineCount)
                : t.download}
        </button>
      </form>

      {playlistData && (
        <PlaylistModal
          playlist={playlistData}
          onDownload={handlePlaylistDownload}
          onClose={handlePlaylistClose}
        />
      )}
    </>
  );
}
