import { useState, useEffect, useCallback } from "react";
import "./App.css";
import UrlInput from "./components/UrlInput";
import DownloadList from "./components/DownloadList";
import Settings from "./components/Settings";
import SearchBar from "./components/SearchBar";
import type { DownloadProgress, AppConfig } from "./lib/tauri";
import {
  downloadBatch,
  onDownloadProgress,
  getConfig,
  checkYtdlpUpdate,
  updateYtdlp,
} from "./lib/tauri";
import { I18nContext, getTranslations, isRTL, useT } from "./lib/i18n";
import type { Language } from "./lib/i18n";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type View = "main" | "settings";
type InputMode = "url" | "search";

type UpdateStatus = "idle" | "available" | "downloading" | "ready";

function UpdateBanner() {
  const t = useT();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const config = await getConfig();

        // Auto-update yt-dlp silently if enabled
        if (config.auto_update) {
          checkYtdlpUpdate()
            .then((info) => {
              if (info.update_available) updateYtdlp().catch(() => {});
            })
            .catch(() => {});
        }

        // Check app update
        const update = await check();
        if (!update) return;

        if (config.auto_update) {
          setStatus("downloading");
          await update.downloadAndInstall();
          setStatus("ready");
          return;
        }

        setVersion(update.version);
        setStatus("available");
      } catch {
        // ignore update check failure
      }
    })();
  }, []);

  async function handleUpdate() {
    if (status !== "available") return;
    setStatus("downloading");
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        setStatus("ready");
      }
    } catch {
      setStatus("available");
    }
  }

  if (status === "idle" || dismissed) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-indigo-600 text-white text-sm">
      <span>
        {status === "available" && `${t.updateAvailable}: v${version}`}
        {status === "downloading" && t.updateDownloading}
        {status === "ready" && t.updateReady}
        {status === "available" && (
          <span className="opacity-75 ms-2">({t.enableAutoUpdate})</span>
        )}
      </span>
      <div className="flex items-center gap-2">
        {status === "available" && (
          <button
            onClick={handleUpdate}
            className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-all font-medium active:scale-[0.97]"
          >
            {t.updateNow}
          </button>
        )}
        {status === "ready" && (
          <button
            onClick={() => relaunch()}
            className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-all font-medium active:scale-[0.97]"
          >
            {t.updateNow}
          </button>
        )}
        {status !== "downloading" && (
          <button
            onClick={() => setDismissed(true)}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-all font-medium active:scale-[0.97]"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
      <h1
        className="text-xl font-bold tracking-tight cursor-pointer text-zinc-900 dark:text-zinc-100"
        onClick={() => setView("main")}
      >
        {t.appTitle}
      </h1>
      <button
        onClick={() => setView(view === "settings" ? "main" : "settings")}
        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors text-sm font-medium"
      >
        {view === "settings" ? t.back : t.settings}
      </button>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("main");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map(),
  );
  const [language, setLanguage] = useState<Language>("he");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load config on mount
  useEffect(() => {
    getConfig().then((cfg: AppConfig) => {
      setLanguage(cfg.language || "he");
      setTheme(cfg.theme || "dark");
    });
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Apply RTL direction
  useEffect(() => {
    document.documentElement.dir = isRTL(language) ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const unlisten = onDownloadProgress((progress) => {
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(progress.id, progress);

        // Remove finished entries beyond a limit to prevent unbounded growth
        const MAX_FINISHED = 50;
        const finished = Array.from(next.entries()).filter(
          ([, p]) =>
            p.status === "done" ||
            p.status === "error" ||
            p.status === "cancelled",
        );
        if (finished.length > MAX_FINISHED) {
          for (const [id] of finished.slice(
            0,
            finished.length - MAX_FINISHED,
          )) {
            next.delete(id);
          }
        }

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

  const handleConfigSaved = useCallback((cfg: AppConfig) => {
    setLanguage(cfg.language || "he");
    setTheme(cfg.theme || "dark");
  }, []);

  const items = Array.from(downloads.values()).reverse();
  const t = getTranslations(language);

  return (
    <I18nContext.Provider value={t}>
      <main className="h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
        <UpdateBanner />
        <Header view={view} setView={setView} />
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
          {view === "settings" ? (
            <Settings
              onClose={() => setView("main")}
              onConfigSaved={handleConfigSaved}
            />
          ) : (
            <>
              <div className="flex gap-1 p-1 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 -mt-1 mb-1 self-start">
                <button
                  onClick={() => setInputMode("url")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    inputMode === "url"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  URL
                </button>
                <button
                  onClick={() => setInputMode("search")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    inputMode === "search"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {t.search}
                </button>
              </div>
              {inputMode === "url" ? (
                <UrlInput onSubmit={handleSubmit} />
              ) : (
                <SearchBar onDownload={handleSubmit} />
              )}
              <DownloadList items={items} />
            </>
          )}
        </div>
      </main>
    </I18nContext.Provider>
  );
}

export default App;
