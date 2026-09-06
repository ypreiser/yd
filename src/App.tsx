import { useState, useEffect, useCallback, useRef } from "react";
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
  checkDiskSpace,
  checkYtdlpUpdate,
  updateYtdlp,
  checkBinaries,
} from "./lib/tauri";
import { I18nContext, getTranslations, isRTL, useT } from "./lib/i18n";
import { useConnectivity } from "./lib/useConnectivity";
import type { Language } from "./lib/i18n";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type InputMode = "url" | "search";

type UpdateStatus = "idle" | "available" | "downloading" | "ready";

function BinaryCheckBanner() {
  const t = useT();
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    checkBinaries().then((m) => setMissing(m)).catch(() => {});
  }, []);

  if (missing.length === 0) return null;

  return (
    <div role="alert" className="flex items-center px-4 py-2 bg-red-600 text-white text-sm">
      {t.missingBinaries(missing.join(", "))}
    </div>
  );
}

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
            aria-label={t.close}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-all font-medium active:scale-[0.97]"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectionIndicator() {
  const t = useT();
  const state = useConnectivity();

  const { dot, label } = {
    online: { dot: "bg-green-500", label: t.online },
    offline: { dot: "bg-red-500", label: t.offline },
    "no-youtube": { dot: "bg-amber-500", label: t.youtubeUnreachable },
  }[state];

  return (
    <span
      className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
      title={`${t.connection}: ${label}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${dot}`}
      />
      <span role="status" aria-label={`${t.connection}: ${label}`}>
        {label}
      </span>
    </span>
  );
}

function Header({
  settingsOpen,
  toggleSettings,
  closeSettings,
}: {
  settingsOpen: boolean;
  toggleSettings: () => void;
  closeSettings: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
      <h1
        className="text-xl font-bold tracking-tight cursor-pointer text-zinc-900 dark:text-zinc-100"
        onClick={closeSettings}
      >
        {t.appTitle}
      </h1>
      <div className="flex items-center gap-4">
        <ConnectionIndicator />
        <button
          onClick={toggleSettings}
          aria-label={settingsOpen ? t.back : t.settings}
          aria-expanded={settingsOpen}
          aria-controls="settings-drawer"
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors text-sm font-medium"
        >
          {settingsOpen ? t.back : t.settings}
        </button>
      </div>
    </div>
  );
}

/**
 * Settings as a drawer over the app rather than a separate screen: downloads
 * keep running and stay visible behind it, and closing returns you exactly
 * where you were. Mounted only while open, so it reloads config each time.
 */
function SettingsDrawer({
  section,
  onClose,
  onConfigSaved,
}: {
  section: "cookies" | null;
  onClose: () => void;
  onConfigSaved: (config: AppConfig) => void;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previousFocus.current?.focus?.();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
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

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="settings-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.settings}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed inset-y-0 end-0 z-50 w-full max-w-md flex flex-col border-s border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-2xl animate-drawer-in outline-none"
      >
        <div className="flex items-center justify-end px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            aria-label={t.close}
            className="rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>
        {/* Settings scrolls its own body, so the drawer must not scroll too. */}
        <div className="flex-1 min-h-0 flex flex-col px-4 pt-3">
          <Settings
            focusSection={section}
            onClose={onClose}
            onConfigSaved={onConfigSaved}
          />
        </div>
      </div>
    </>
  );
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Set when the drawer is opened from an auth error, so it lands on cookies.
  const [settingsSection, setSettingsSection] = useState<"cookies" | null>(null);
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
    let ignore = false;
    let cleanup: (() => void) | undefined;

    onDownloadProgress((progress) => {
      if (ignore) return;
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(progress.id, progress);

        // Remove finished entries beyond a limit to prevent unbounded growth
        const MAX_FINISHED = 50;
        const finished = Array.from(next.entries()).filter(
          ([, p]) =>
            p.status === "done" ||
            p.status === "already_exists" ||
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
    }).then((unlisten) => {
      if (ignore) {
        unlisten();
      } else {
        cleanup = unlisten;
      }
    });

    return () => {
      ignore = true;
      cleanup?.();
    };
  }, []);

  const handleSubmit = useCallback(async (urls: string[]) => {
    try {
      const cfg = await getConfig();
      const MB_500 = 500 * 1024 * 1024;
      try {
        const free = await checkDiskSpace(cfg.download_dir);
        if (free < MB_500) {
          const t = getTranslations(cfg.language || "he");
          if (!window.confirm(t.lowDiskSpace)) return;
        }
      } catch { /* ignore disk check failure */ }
      await downloadBatch(urls);
    } catch (e) {
      console.error("download failed:", e);
    }
  }, []);

  const handleClear = useCallback(() => {
    setDownloads((prev) => {
      const next = new Map(prev);
      for (const [id, p] of next) {
        if (p.status === "done" || p.status === "already_exists" || p.status === "error" || p.status === "cancelled") {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const handleRetry = useCallback(async (url: string) => {
    try {
      await downloadBatch([url]);
    } catch (e) {
      console.error("retry failed:", e);
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
        <BinaryCheckBanner />
        <UpdateBanner />
        <Header
          settingsOpen={settingsOpen}
          toggleSettings={() => {
            setSettingsSection(null);
            setSettingsOpen((open) => !open);
          }}
          closeSettings={() => setSettingsOpen(false)}
        />
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
          <div role="tablist" className="flex gap-1 p-1 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 -mt-1 mb-1 self-start">
            <button
              role="tab"
              aria-selected={inputMode === "url"}
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
              role="tab"
              aria-selected={inputMode === "search"}
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
          <DownloadList
            items={items}
            onClear={handleClear}
            onRetry={handleRetry}
            onFixCookies={() => {
              setSettingsSection("cookies");
              setSettingsOpen(true);
            }}
          />
        </div>
        {settingsOpen && (
          <SettingsDrawer
            section={settingsSection}
            onClose={() => setSettingsOpen(false)}
            onConfigSaved={handleConfigSaved}
          />
        )}
      </main>
    </I18nContext.Provider>
  );
}

export default App;
