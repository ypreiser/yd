import { useState, useEffect, useCallback } from "react";
import "./App.css";
import UrlInput from "./components/UrlInput";
import DownloadList from "./components/DownloadList";
import Settings from "./components/Settings";
import type { DownloadProgress, AppConfig } from "./lib/tauri";
import { downloadBatch, onDownloadProgress, getConfig } from "./lib/tauri";
import { I18nContext, getTranslations, isRTL, useT } from "./lib/i18n";
import type { Language } from "./lib/i18n";

type View = "main" | "settings";

function Header({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
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
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map()
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
        <Header view={view} setView={setView} />
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
          {view === "settings" ? (
            <Settings
              onClose={() => setView("main")}
              onConfigSaved={handleConfigSaved}
            />
          ) : (
            <>
              <UrlInput onSubmit={handleSubmit} />
              <DownloadList items={items} />
            </>
          )}
        </div>
      </main>
    </I18nContext.Provider>
  );
}

export default App;
