import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppConfig } from "../lib/tauri";
import { getConfig, setConfig } from "../lib/tauri";

interface SettingsProps {
  onClose: () => void;
}

const AUDIO_FORMATS = ["m4a", "mp3", "opus", "flac"];

export default function Settings({ onClose }: SettingsProps) {
  const [config, setLocalConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setLocalConfig);
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
    onClose();
  }

  if (!config) return null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-zinc-400">Download Directory</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.download_dir}
            onChange={(e) =>
              setLocalConfig({ ...config, download_dir: e.target.value })
            }
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handlePickDir}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Browse
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-zinc-400">Audio Format</label>
        <select
          value={config.audio_format}
          onChange={(e) =>
            setLocalConfig({ ...config, audio_format: e.target.value })
          }
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {AUDIO_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
