# YD - YouTube Song Downloader

Tauri v2 desktop app for downloading YouTube songs as audio files using yt-dlp.

## Features

- Single or batch URL download (paste multiple URLs, one per line)
- Parallel downloads (max 5 concurrent)
- Audio format selection (M4A default, MP3, OPUS, FLAC)
- Configurable download directory
- Progress tracking per download
- Bundled yt-dlp + ffmpeg (no external dependencies)

## Install

Download the latest installer from [Releases](https://github.com/ypreiser/yd/releases/latest). Everything is bundled — no extra setup needed.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

### Download sidecar binaries

Place these in `src-tauri/binaries/`:

1. **yt-dlp**: Download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest) → `yt-dlp.exe` → rename to `yt-dlp-x86_64-pc-windows-msvc.exe`
2. **ffmpeg + ffprobe**: Download from [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) → extract `ffmpeg.exe` and `ffprobe.exe` → rename to `ffmpeg-x86_64-pc-windows-msvc.exe` and `ffprobe-x86_64-pc-windows-msvc.exe`

### Build & run

```bash
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs MSI + NSIS installer)
```

## Screenshots

<!-- TODO: Add screenshots -->

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Rust (Tauri v2)
- **Audio**: yt-dlp + ffmpeg (bundled as sidecars)
