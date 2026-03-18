import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppConfig } from "../lib/tauri";
import {
  getConfig,
  setConfig,
  getYtdlpVersion,
  checkYtdlpUpdate,
  updateYtdlp,
} from "../lib/tauri";
import { useT } from "../lib/i18n";
import { getVersion } from "@tauri-apps/api/app";

interface SettingsProps {
  onClose: () => void;
  onConfigSaved: (config: AppConfig) => void;
}

const AUDIO_FORMATS = ["m4a", "mp3", "opus", "flac"];

export default function Settings({ onClose, onConfigSaved }: SettingsProps) {
  const t = useT();
  const [config, setLocalConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [ytdlpVer, setYtdlpVer] = useState("");
  const [ytdlpLatest, setYtdlpLatest] = useState("");
  const [ytdlpStatus, setYtdlpStatus] = useState<
    "idle" | "checking" | "available" | "updating" | "done" | "error"
  >("idle");

  useEffect(() => {
    getConfig().then(setLocalConfig);
    getVersion().then(setAppVersion);
    getYtdlpVersion()
      .then(setYtdlpVer)
      .catch(() => {});
  }, []);

  async function handlePickDir() {
    const dir = await open({ directory: true, multiple: false });
    if (dir && config) {
      setLocalConfig({ ...config, download_dir: dir as string });
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    await setConfig(config);
    setSaving(false);
    onConfigSaved(config);
    onClose();
  }

  if (!config) return null;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors";

  return (
    <div className="overflow-y-auto flex-1">
      <div className="flex flex-col gap-6 max-w-lg">
        <h2 className="text-lg font-semibold">{t.settings}</h2>

        {/* Download Directory */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="download-dir-input"
            className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            {t.downloadDir}
          </label>
          <div className="flex gap-2">
            <input
              id="download-dir-input"
              type="text"
              placeholder={t.downloadDir}
              value={config.download_dir}
              onChange={(e) =>
                setLocalConfig({ ...config, download_dir: e.target.value })
              }
              className={`flex-1 ${inputClass}`}
            />
            <button
              onClick={handlePickDir}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              {t.browse}
            </button>
          </div>
        </div>

        {/* Audio Format */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="audio-format-select"
            className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            {t.audioFormat}
          </label>
          <select
            id="audio-format-select"
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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

        {/* Auto Update */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t.autoUpdate}
          </label>
          <div className="flex gap-2">
            {([false, true] as const).map((val) => (
              <button
                key={String(val)}
                onClick={() => setLocalConfig({ ...config, auto_update: val })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
          <div className="flex items-center gap-2">
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
              <span className="text-xs text-indigo-400">{t.ytdlpUpdating}</span>
            )}
            {ytdlpStatus === "done" && (
              <span className="text-xs text-green-500">{t.ytdlpUpToDate}</span>
            )}
            {ytdlpStatus === "error" && (
              <span className="text-xs text-red-500">{t.ytdlpUpdateError}</span>
            )}
          </div>
        </div>

        {/* App Version */}
        {appVersion && (
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            {t.version} {appVersion}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
