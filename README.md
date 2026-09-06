# YD - YouTube Song Downloader

Tauri v2 desktop app for downloading YouTube songs as audio files using yt-dlp.

## Features

- Single or batch URL download (paste multiple URLs, one per line)
- Parallel downloads (max 5 concurrent)
- Audio format selection (M4A default, MP3, OPUS, FLAC)
- Configurable download directory
- Progress tracking per download
- Bundled yt-dlp + ffmpeg (no external dependencies)
- Online / offline indicator (tells "no internet" apart from "YouTube unreachable")
- Cookie support with in-app, step-by-step instructions for YouTube's bot check
- Local error log and a one-click, user-reviewed bug report

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

### Checks

```bash
npx tsc --noEmit          # types
npm test                  # unit tests (vitest)
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

CI (`.github/workflows/ci.yml`) runs all of these on every push to `main` and
every pull request. The Rust job runs on Windows, the shipped target.

### Build & run

```bash
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs MSI + NSIS installer)
```

## Troubleshooting

### `Sign in to confirm you're not a bot`

YouTube throws this at requests that come from an unauthenticated session. Two
things fix it, in order of effort:

1. **Update yt-dlp** — Settings → yt-dlp Version → Check / Update. YouTube
   changes its checks often and yt-dlp keeps up.
2. **Give yt-dlp cookies from a signed-in session** — Settings → YouTube
   Cookies:
   - **From browser**: pick the browser you're signed in to YouTube with.
     Firefox is the most reliable choice; on Windows, Chrome/Edge/Brave encrypt
     their cookie store so yt-dlp often cannot read it, and the browser must be
     fully closed while downloading.
   - **cookies.txt file**: export cookies for `youtube.com` in Netscape format
     with a browser extension and point the app at the file. This is the option
     that always works, including on Windows.

Cookie handling notes:

- Cookies give this app the same access to YouTube as your logged-in browser.
  Prefer a throwaway Google account over your main one.
- Export from a private/incognito window that you close *without logging out*
  after exporting — otherwise YouTube rotates the cookies and they stop working.
- The cookies file is read by yt-dlp straight from the path you choose; the app
  never copies, uploads or logs its contents. Keep the file somewhere only your
  user account can read.
- Only the browser names in the dropdown and an existing absolute file path are
  accepted, so a hand-edited `config.json` can't turn these settings into extra
  yt-dlp command-line flags.

## Reporting a problem

Settings → **Report a Problem**:

1. **Prepare report** builds the report text — app/OS/yt-dlp version, the current
   audio and cookie settings, and the last 40 logged errors.
2. The full text is shown for review first. Nothing leaves the machine until you
   press **Open GitHub issue**, which opens a browser with the text pre-filled
   in a new issue you still have to submit yourself. **Copy** puts the same text
   on the clipboard if you'd rather send it another way.
3. **Open log folder** reveals `errors.log`; **Clear log** empties it.

What the log contains, and what it never contains:

- Errors are redacted *as they are written*, not when a report is built, so the
  file on disk is already safe to share: the home directory is replaced with
  `~`, the user name with `<user>`, and any `--cookies`, `--cookies-from-browser`
  or `Cookie:` value with `<redacted>`.
- The report deliberately omits your download directory and cookie file path.
- The log rotates at 256 KB and keeps one previous file, so it cannot grow
  without bound.

## Network activity

Besides yt-dlp's own traffic, the app makes two kinds of request:

- **Update checks** to the GitHub API (yt-dlp) and the app's update endpoint.
- **Connectivity probes** every 30 seconds while the app is open:
  `https://www.youtube.com/generate_204`, and only if that fails,
  `https://www.cloudflare.com/cdn-cgi/trace` to tell "offline" apart from
  "YouTube unreachable". Both are no-content endpoints; nothing about you or
  your downloads is sent.

## Screenshots

<!-- TODO: Add screenshots -->

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Rust (Tauri v2)
- **Audio**: yt-dlp + ffmpeg (bundled as sidecars)
