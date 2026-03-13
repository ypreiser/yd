# Plan: YD - YouTube Song Downloader (Tauri + yt-dlp)

**Date**: 2026-03-12
**Status**: Draft
**Author**: Claude + user

## Context

Empty repo (`yd`). Need to build a desktop app from scratch for downloading YouTube songs using yt-dlp as the backend engine.

## Goal

Simple, clean Tauri desktop app that lets users paste YouTube URLs (single or batch), pick a download directory, and download audio files via yt-dlp. Minimal UI, fast, reliable. Batteries included — bundles yt-dlp and ffmpeg so user needs zero setup.

## Approach

- **Tauri v2** (Rust backend + web frontend)
- **React + Vite + TypeScript** frontend (standard Tauri v2 scaffold)
- **Tailwind CSS** for styling
- **yt-dlp + ffmpeg bundled** as sidecar binaries via Tauri's `externalBin` / resource system
- Downloads extract audio as **M4A by default** (yt-dlp `--extract-audio --audio-format m4a`)
- **Parallel downloads** for batch mode (tokio tasks, one yt-dlp process per URL)
- Settings persisted to disk via Tauri's `app_data_dir` (JSON config file)
- Download progress parsed from yt-dlp stdout and streamed to frontend via Tauri events

### Architecture

```
Frontend (React + Tailwind)   Backend (Rust/Tauri)
┌──────────────┐             ┌──────────────────────┐
│ URL input    │──invoke────▶│ validate_url()        │
│ Batch input  │──invoke────▶│ download_song()       │
│ Progress bar │◀──event────│ yt-dlp sidecar process│
│ Settings     │──invoke────▶│ get/set_config()      │
│ Dir picker   │──invoke────▶│ Tauri dialog API      │
└──────────────┘             └──────────────────────┘
                              Bundled binaries:
                              - yt-dlp(.exe)
                              - ffmpeg(.exe)
```

### Bundling Strategy

- Place platform-specific yt-dlp and ffmpeg binaries in `src-tauri/binaries/`
- Use Tauri's [sidecar](https://v2.tauri.app/develop/sidecar/) feature to bundle them
- At runtime, resolve sidecar path and invoke yt-dlp with `--ffmpeg-location` pointing to bundled ffmpeg
- Binary naming follows Tauri convention: `yt-dlp-x86_64-pc-windows-msvc.exe` etc.

### Key Tauri Commands (Rust → JS bridge)

| Command | Purpose |
|---------|---------|
| `download` | Download single URL (spawns yt-dlp sidecar) |
| `download_batch` | Download list of URLs in parallel |
| `cancel_download` | Kill a running yt-dlp process |
| `get_config` | Read config from disk |
| `set_config` | Write config to disk |

## Scope

### In Scope

- Single URL download (paste & go)
- Batch download (paste multiple URLs, one per line) — **parallel**
- Download directory picker (Tauri dialog)
- Persistent config (download dir, audio format)
- Download progress display per song
- Download history (current session)
- Bundled yt-dlp + ffmpeg (no user install needed)

### Out of Scope

- Playlist URL auto-expansion (future enhancement)
- Video download (audio only for now)
- Auto-update for bundled yt-dlp/ffmpeg
- Search YouTube from within app
- Queue management / pause / resume
- Metadata editing / album art

## Affected Areas

- **Files**: All new — Tauri scaffold + custom components
- **Dependencies**: `@tauri-apps/cli`, `@tauri-apps/api`, React, Vite, TypeScript, Tailwind CSS, `serde`/`serde_json`/`tokio` (Rust)
- **Binaries**: yt-dlp.exe, ffmpeg.exe (Windows; other platforms later)
- **Tests**: Rust unit tests for config read/write, URL validation
- **Docs**: README with build instructions

## Risks

- **Binary size**: yt-dlp (~10MB) + ffmpeg (~80-130MB) makes app large. Acceptable tradeoff for zero-setup UX.
- **Licensing**: yt-dlp is Unlicense, ffmpeg is LGPL/GPL — need to comply with ffmpeg license (ship as separate binary, not linked, so LGPL is fine)
- **yt-dlp output format changes**: Mitigated by loose regex parsing of progress; fallback to "downloading..." if parse fails
- **Platform builds**: Initially Windows only; Mac/Linux need their own binaries added later

## Phases

1. **Scaffold** — Tauri v2 project setup with React+Vite+TS+Tailwind
2. **Backend core** — Rust commands: config management, sidecar setup, single download with progress events
3. **Frontend core** — URL input, download button, progress display, settings page with dir picker
4. **Batch + parallel** — Multi-URL input, parallel download with per-item progress
5. **Polish** — Error handling, cancel support, styling refinements

## Open Questions

- [x] Audio format preference? → **M4A default**
- [x] Batch: sequential or parallel? → **Parallel**
- [x] CSS framework? → **Tailwind**
- [x] Bundle binaries? → **Yes, yt-dlp + ffmpeg as sidecars**
- [x] Max concurrent parallel downloads? → **5**
- [x] Windows-only first? → **Yes, Windows only**
