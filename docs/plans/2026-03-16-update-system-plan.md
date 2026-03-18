# Plan: Unified Update System with Local yt-dlp Updates

**Date**: 2026-03-16
**Status**: Approved
**Author**: Claude + user

## Context

- Tauri v2 desktop app bundling yt-dlp as a sidecar binary
- yt-dlp breaks often when YouTube changes things — users need fast updates
- App already has `tauri-plugin-updater` for app updates

## Goal

Users can update yt-dlp locally from within the app (like Seal), plus app auto-update toggle with rollback.

## Approach

1. **Local yt-dlp update** — Check GitHub for latest yt-dlp release, download and overwrite the sidecar binary in-place. Sidecar lives in user-writable dir (%LOCALAPPDATA%), so no permission issues.
2. **App update banner** — Single `UpdateBanner` checks for app updates via `tauri-plugin-updater`. Auto-update toggle (default off). Saves previous version for rollback.
3. **Settings UI** — yt-dlp version + check/update button, app auto-update toggle, rollback button.

### Why not GH Action?

GH Actions can't smoke-test YouTube (bot detection). Local update is simpler, faster, and gives users control.

## Scope

### In Scope
- `check_ytdlp_update` + `update_ytdlp` Rust commands (reqwest + GitHub API)
- yt-dlp update UI in Settings
- App update banner with auto-update toggle
- Local rollback via `previous_version` config

### Out of Scope
- GH Action for yt-dlp (removed)
- ffmpeg updates
- macOS/Linux

## Affected Areas
- `src-tauri/src/download.rs` — new commands
- `src-tauri/Cargo.toml` — reqwest dependency
- `src/components/Settings.tsx` — yt-dlp update UI
- `src/App.tsx` — unified update banner
- `src/lib/tauri.ts` — TypeScript bindings
- `src/lib/i18n.tsx` — translations
