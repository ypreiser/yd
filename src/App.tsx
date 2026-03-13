import { useState, useEffect, useCallback } from "react";
import "./App.css";
import UrlInput from "./components/UrlInput";
import DownloadList from "./components/DownloadList";
import Settings from "./components/Settings";
import type { DownloadProgress } from "./lib/tauri";
import { downloadBatch, onDownloadProgress } from "./lib/tauri";

type View = "main" | "settings";

function App() {
  const [view, setView] = useState<View>("main");
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map()
  );

  useEffect(() => {
    const unlisten = onDownloadProgress((progress) => {
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(progress.id, progress);
        return next;
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSubmit = useCallback(async (urls: string[]) => {
    try {
      await downloadBatch(urls);
    } catch (e) {
      console.error("download failed:", e);
    }
  }, []);

  const items = Array.from(downloads.values()).reverse();

  return (
    <main className="h-screen bg-zinc-900 text-zinc-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1
          className="text-xl font-bold tracking-tight cursor-pointer"
          onClick={() => setView("main")}
        >
          YD
        </h1>
        <button
          onClick={() => setView(view === "settings" ? "main" : "settings")}
          className="text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
        >
          {view === "settings" ? "Back" : "Settings"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        {view === "settings" ? (
          <Settings onClose={() => setView("main")} />
        ) : (
          <>
            <UrlInput onSubmit={handleSubmit} />
            <DownloadList items={items} />
          </>
        )}
      </div>
    </main>
  );
}

export default App;
