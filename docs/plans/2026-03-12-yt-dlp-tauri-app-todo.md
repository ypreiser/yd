# TODO: YD - YouTube Song Downloader

**Plan**: [plan](./2026-03-12-yt-dlp-tauri-app-plan.md)
**Date**: 2026-03-12
**Status**: Done

## Phase 1: Scaffold

**Acceptance**: `cargo tauri dev` launches app with Tailwind-styled "Hello World" page

- [x] Init Tauri v2 project with React+Vite+TS template (`npm create tauri-app@latest`)
- [x] Install & configure Tailwind CSS v4
- [x] Verify `cargo tauri dev` builds and opens window
- [x] Set app metadata in `src-tauri/tauri.conf.json` (name: "yd", title: "YD", window size)

## Phase 2: Backend Core

**Acceptance**: Can invoke `download` command from frontend, yt-dlp runs, progress events stream to frontend

- [x] Download yt-dlp.exe and ffmpeg.exe, place in `src-tauri/binaries/` with Tauri sidecar naming (`yt-dlp-x86_64-pc-windows-msvc.exe`, `ffmpeg-x86_64-pc-windows-msvc.exe`)
- [x] Configure sidecars in `src-tauri/tauri.conf.json` (`bundle.externalBin`)
- [x] `src-tauri/src/config.rs` — Config struct (download_dir, audio_format) + load/save JSON to `app_data_dir`
- [x] `src-tauri/src/config.rs` — Tauri commands: `get_config`, `set_config`
- [x] `src-tauri/src/download.rs` — `download` command: spawn yt-dlp sidecar, parse stdout progress (`[download] XX.X%`), emit Tauri events (`download-progress`, `download-complete`, `download-error`) with download ID
- [x] `src-tauri/src/download.rs` — Pass `--ffmpeg-location` pointing to bundled ffmpeg path
- [x] `src-tauri/src/lib.rs` — Register all commands, wire up module structure
- [x] Add `tokio`, `serde`, `serde_json`, `uuid` to Cargo dependencies
- [x] Enable required Tauri permissions: `dialog:open`, `shell:sidecar`, events
- [x] Verify: manually test single download via frontend devtools `invoke("download", ...)`

## Phase 3: Frontend Core

**Acceptance**: User can paste URL, click download, see progress bar, pick download dir in settings

- [x] `src/App.tsx` — Main layout with two views: Download + Settings (simple tab/nav)
- [x] `src/components/UrlInput.tsx` — Text input for single URL + "Download" button
- [x] `src/components/DownloadItem.tsx` — Single download row: title/URL, progress bar, status (downloading/done/error)
- [x] `src/components/DownloadList.tsx` — List of DownloadItem components (current session)
- [x] `src/components/Settings.tsx` — Download dir picker (Tauri dialog), audio format dropdown (m4a/mp3/opus/flac)
- [x] `src/lib/tauri.ts` — Typed wrappers around `invoke` calls and event listeners
- [x] Wire up progress events: listen to `download-progress` / `download-complete` / `download-error`, update state
- [x] Style all components with Tailwind (clean, minimal dark theme)
- [x] Verify: end-to-end single song download with visible progress

## Phase 4: Batch + Parallel

**Acceptance**: User can paste multiple URLs, all download in parallel (max 5), each with individual progress

- [x] `src/components/UrlInput.tsx` — Expand to textarea for multi-URL (one per line), detect batch mode
- [x] `src-tauri/src/download.rs` — `download_batch` command: accept Vec<String>, spawn up to 5 concurrent yt-dlp processes via tokio semaphore, each emitting events with unique ID
- [x] `src-tauri/src/download.rs` — `cancel_download` command: kill yt-dlp child process by ID
- [x] Frontend: map batch URLs to individual DownloadItem components, each tracking its own progress
- [x] Verify: paste 7+ URLs, confirm max 5 run concurrently, remaining queued

## Phase 5: Polish

**Acceptance**: App feels complete — errors handled, cancel works, looks good

- [x] Error states: invalid URL, yt-dlp failure, network error — show in UI per download item
- [x] Cancel button on each in-progress download item
- [x] Startup validation: check bundled yt-dlp/ffmpeg exist, show error if missing
- [x] Empty state UI when no downloads yet
- [x] Update README with build instructions and screenshots placeholder
- [x] `src-tauri/tauri.conf.json` — Set app icon

## Final Checklist

- [x] All commands work end-to-end (single, batch, cancel, config)
- [x] No security issues (no shell injection — URLs passed as args, not interpolated)
- [x] Parallel limit of 5 enforced
- [x] Config persists across app restarts
- [x] README updated
