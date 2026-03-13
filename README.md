# YD - YouTube Song Downloader

Tauri v2 desktop app for downloading YouTube songs as audio files using yt-dlp.

## Features

- Single or batch URL download (paste multiple URLs, one per line)
- Parallel downloads (max 5 concurrent)
- Audio format selection (M4A default, MP3, OPUS, FLAC)
- Configurable download directory
- Progress tracking per download
- Bundled yt-dlp + ffmpeg (no external dependencies)

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

### Download sidecar binaries

Place these in `src-tauri/binaries/`:

1. **yt-dlp**: Download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest) → `yt-dlp.exe` → rename to `yt-dlp-x86_64-pc-windows-msvc.exe`
2. **ffmpeg**: Download from [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) → extract `ffmpeg.exe` → rename to `ffmpeg-x86_64-pc-windows-msvc.exe`

### Build & run

```bash
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs MSI + NSIS installer)
```

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Rust (Tauri v2)
- **Audio**: yt-dlp + ffmpeg (bundled as sidecars)
