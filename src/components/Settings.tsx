import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { AppConfig, CookiesMode } from "../lib/tauri";
import {
  getConfig,
  setConfig,
  getYtdlpVersion,
  checkYtdlpUpdate,
  updateYtdlp,
  COOKIE_BROWSERS,
  errorLogInfo,
  clearErrorLog,
  buildErrorReport,
} from "../lib/tauri";
import { useT } from "../lib/i18n";
import { getVersion } from "@tauri-apps/api/app";

interface SettingsProps {
  onClose: () => void;
  onConfigSaved: (config: AppConfig) => void;
}

const AUDIO_FORMATS = ["m4a", "mp3", "opus", "flac"];

/** yt-dlp's own, always-current guide to exporting YouTube cookies. */
const COOKIE_GUIDE_URL =
  "https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies";
const ISSUE_URL = "https://github.com/ypreiser/yd/issues/new";
/** Browsers refuse very long URLs, and GitHub truncates anyway. */
const MAX_ISSUE_BODY = 4000;

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {title}
      </p>
      <ol className="list-decimal ms-5 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800/30 p-4 flex flex-col gap-4">
      {children}
    </div>
  );
}

export default function Settings({ onClose, onConfigSaved }: SettingsProps) {
  const t = useT();
  const [config, setLocalConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [ytdlpVer, setYtdlpVer] = useState("");
  const [ytdlpLatest, setYtdlpLatest] = useState("");
  const [ytdlpStatus, setYtdlpStatus] = useState<
    "idle" | "checking" | "available" | "updating" | "done" | "error"
  >("idle");
  const [logPath, setLogPath] = useState("");
  const [logEntries, setLogEntries] = useState(0);
  const [report, setReport] = useState<string | null>(null);
  const [reportError, setReportError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getConfig().then(setLocalConfig);
    getVersion().then(setAppVersion);
    getYtdlpVersion()
      .then(setYtdlpVer)
      .catch(() => {});
    errorLogInfo()
      .then((info) => {
        setLogPath(info.path);
        setLogEntries(info.entries);
      })
      .catch(() => {});
  }, []);

  async function handlePrepareReport() {
    setReportError(false);
    setCopied(false);
    try {
      setReport(await buildErrorReport(ytdlpVer || undefined));
    } catch {
      setReportError(true);
    }
  }

  async function handleCopyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleOpenIssue() {
    if (!report) return;
    const body = report.slice(0, MAX_ISSUE_BODY);
    await openUrl(
      `${ISSUE_URL}?title=${encodeURIComponent("Bug report")}&body=${encodeURIComponent(body)}`
    );
  }

  async function handleClearLog() {
    await clearErrorLog();
    setLogEntries(0);
    setReport(null);
  }

  async function handlePickDir() {
    const dir = await open({ directory: true, multiple: false });
    if (dir && config) {
      setLocalConfig({ ...config, download_dir: dir as string });
    }
  }

  async function handlePickCookiesFile() {
    const file = await open({
      multiple: false,
      filters: [{ name: "Cookies", extensions: ["txt"] }],
    });
    if (file && config) {
      setLocalConfig({ ...config, cookies_file: file as string });
    }
  }

  function setCookiesMode(mode: CookiesMode) {
    if (!config) return;
    setLocalConfig({
      ...config,
      cookies_mode: mode,
      // Default to Firefox: on Windows, Chromium browsers encrypt their cookie
      // store in a way yt-dlp usually cannot read.
      cookies_browser:
        mode === "browser" && !config.cookies_browser
          ? "firefox"
          : config.cookies_browser,
    });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      await setConfig(config);
    } catch (err) {
      // Backend validation rejected something (e.g. a cookies file that is
      // missing or not an absolute path) — keep the dialog open and say so.
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    onConfigSaved(config);
    onClose();
  }

  if (!config) return null;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all";

  return (
    <div className="overflow-y-auto flex-1 min-h-0">
      <div className="flex flex-col gap-4 max-w-lg">
        <h2 className="text-lg font-semibold">{t.settings}</h2>

        {/* Download Settings */}
        <Section>
          {/* Download Directory */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="download-dir"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
            >
              {t.downloadDir}
            </label>
            <div className="flex gap-2">
              <input
                id="download-dir"
                type="text"
                value={config.download_dir}
                onChange={(e) =>
                  setLocalConfig({ ...config, download_dir: e.target.value })
                }
                className={`flex-1 ${inputClass}`}
              />
              <button
                onClick={handlePickDir}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
              >
                {t.browse}
              </button>
            </div>
          </div>

          {/* Audio Format */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="audio-format"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
            >
              {t.audioFormat}
            </label>
            <select
              id="audio-format"
              title={t.audioFormat}
              value={config.audio_format}
              onChange={(e) =>
                setLocalConfig({ ...config, audio_format: e.target.value })
              }
              className={inputClass}
            >
              {AUDIO_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </Section>

        {/* Appearance */}
        <Section>
          {/* Theme */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.theme}
            </label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => setLocalConfig({ ...config, theme: th })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    config.theme === th
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {th === "dark" ? t.themeDark : t.themeLight}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.language}
            </label>
            <div className="flex gap-2">
              {[
                { code: "he" as const, label: "עברית" },
                { code: "en" as const, label: "English" },
              ].map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => setLocalConfig({ ...config, language: code })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    config.language === code
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Metadata */}
        <Section>
          {/* Embed Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.metadata}
            </label>
            <div className="flex gap-2">
              {([
                { key: "embed_title" as const, label: t.embedTitle },
                { key: "embed_thumbnail" as const, label: t.embedThumbnail },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    setLocalConfig({ ...config, [key]: !config[key] })
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    config[key]
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Flip Hebrew */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                onClick={() =>
                  config.embed_title &&
                  setLocalConfig({
                    ...config,
                    flip_hebrew_in_title: !config.flip_hebrew_in_title,
                  })
                }
                disabled={!config.embed_title}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  config.flip_hebrew_in_title && config.embed_title
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                } ${!config.embed_title ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {t.flipHebrewInTitle}
              </button>
            </div>
          </div>
        </Section>

        {/* YouTube Cookies */}
        <Section>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.cookies}
            </label>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t.cookiesHelp}
            </p>
            <div className="flex gap-2">
              {([
                { mode: "none" as const, label: t.cookiesNone },
                { mode: "browser" as const, label: t.cookiesFromBrowser },
                { mode: "file" as const, label: t.cookiesFromFile },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setCookiesMode(mode)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    config.cookies_mode === mode
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {config.cookies_mode === "browser" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cookies-browser"
                className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
              >
                {t.cookiesBrowser}
              </label>
              <select
                id="cookies-browser"
                title={t.cookiesBrowser}
                value={config.cookies_browser || "firefox"}
                onChange={(e) =>
                  setLocalConfig({ ...config, cookies_browser: e.target.value })
                }
                className={inputClass}
              >
                {COOKIE_BROWSERS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.cookies_mode === "file" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cookies-file"
                className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
              >
                {t.cookiesFile}
              </label>
              <div className="flex gap-2">
                <input
                  id="cookies-file"
                  type="text"
                  value={config.cookies_file}
                  onChange={(e) =>
                    setLocalConfig({ ...config, cookies_file: e.target.value })
                  }
                  className={`flex-1 ${inputClass}`}
                />
                <button
                  onClick={handlePickCookiesFile}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
                >
                  {t.browse}
                </button>
              </div>
            </div>
          )}

          {config.cookies_mode !== "none" && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t.cookiesWarning}
            </p>
          )}

          <details className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {t.cookiesHowTo}
            </summary>
            <div className="flex flex-col gap-3 pt-3">
              <Steps
                title={t.cookiesFromBrowser}
                steps={t.cookiesStepsBrowser}
              />
              <Steps title={t.cookiesFromFile} steps={t.cookiesStepsFile} />
              <button
                onClick={() => openUrl(COOKIE_GUIDE_URL)}
                className="self-start text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t.cookiesGuideLink} ↗
              </button>
            </div>
          </details>
        </Section>

        {/* Updates */}
        <Section>
          {/* Auto Update */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.autoUpdate}
            </label>
            <div className="flex gap-2">
              {([false, true] as const).map((val) => (
                <button
                  key={String(val)}
                  onClick={() =>
                    setLocalConfig({ ...config, auto_update: val })
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    config.auto_update === val
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {val ? t.autoUpdateOn : t.autoUpdateOff}
                </button>
              ))}
            </div>
          </div>

          {/* yt-dlp Version + Update */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.ytdlpVersion}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {ytdlpVer || "..."}
              </span>
              {ytdlpStatus === "idle" && (
                <button
                  onClick={async () => {
                    setYtdlpStatus("checking");
                    try {
                      const info = await checkYtdlpUpdate();
                      if (info.update_available) {
                        setYtdlpLatest(info.latest);
                        setYtdlpStatus("available");
                      } else {
                        setYtdlpStatus("done");
                      }
                    } catch {
                      setYtdlpStatus("error");
                    }
                  }}
                  className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t.checkForYtdlpUpdate}
                </button>
              )}
              {ytdlpStatus === "checking" && (
                <span className="text-xs text-zinc-400">{t.searching}</span>
              )}
              {ytdlpStatus === "available" && (
                <>
                  <span className="text-xs text-amber-500">
                    {t.ytdlpUpdateAvailable(ytdlpLatest)}
                  </span>
                  <button
                    onClick={async () => {
                      setYtdlpStatus("updating");
                      try {
                        const newVer = await updateYtdlp();
                        console.log({ newVer });
                        setYtdlpVer(newVer);
                        setYtdlpStatus("done");
                      } catch {
                        setYtdlpStatus("error");
                      }
                    }}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    {t.updateYtdlp}
                  </button>
                </>
              )}
              {ytdlpStatus === "updating" && (
                <span className="text-xs text-indigo-400">
                  {t.ytdlpUpdating}
                </span>
              )}
              {ytdlpStatus === "done" && (
                <span className="text-xs text-green-500">
                  {t.ytdlpUpToDate}
                </span>
              )}
              {ytdlpStatus === "error" && (
                <span className="text-xs text-red-500">
                  {t.ytdlpUpdateError}
                </span>
              )}
            </div>
          </div>

          {/* App Version */}
          {appVersion && (
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              {t.version} {appVersion}
            </div>
          )}
        </Section>

        {/* Problem reports */}
        <Section>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t.reportProblem}
            </label>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t.reportHelp}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {t.logEntries(logEntries)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrepareReport}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
            >
              {t.prepareReport}
            </button>
            {logPath && (
              <button
                onClick={() => revealItemInDir(logPath)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
              >
                {t.openLogFolder}
              </button>
            )}
            {logEntries > 0 && (
              <button
                onClick={handleClearLog}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
              >
                {t.clearLog}
              </button>
            )}
          </div>

          {reportError && (
            <p className="text-sm text-red-500">{t.reportError}</p>
          )}

          {report !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t.reportConsent}
              </p>
              <textarea
                readOnly
                value={report}
                aria-label={t.reportProblem}
                rows={10}
                className={`${inputClass} font-mono text-xs`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleOpenIssue}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:scale-[0.97] transition-all"
                >
                  {t.openGithubIssue}
                </button>
                <button
                  onClick={handleCopyReport}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all"
                >
                  {copied ? t.reportCopied : t.copyReport}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Actions */}
        {saveError && (
          <p className="text-sm text-red-500" role="alert">
            {t.settingsSaveError}: {saveError}
          </p>
        )}
        <div className="flex gap-2 justify-end pt-2 pb-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97] transition-all"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-40 transition-all"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
