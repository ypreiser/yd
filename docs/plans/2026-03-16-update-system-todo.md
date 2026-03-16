# TODO: Unified Update System with Auto-Update Setting

**Plan**: [link to plan doc](./2026-03-16-update-system-plan.md)
**Date**: 2026-03-16
**Status**: In Progress

## Phase 1: Config + Settings

**Acceptance**: `auto_update` field persisted in config, toggle visible in settings, yt-dlp version displayed in settings

- [x] `src-tauri/src/config.rs` — Add `auto_update: bool` and `previous_version: Option<String>` fields to `AppConfig`
- [x] `src/lib/tauri.ts` — Add `auto_update` and `previous_version` to `AppConfig` interface
- [x] `src/lib/i18n.tsx` — Add translations: `autoUpdate`, `autoUpdateOn/Off`, `ytdlpVersion`, `rollback`, `rollbackConfirm`, `rollingBack`, `enableAutoUpdate`, `autoUpdating`
- [x] `src/components/Settings.tsx` — Add auto-update toggle, show yt-dlp version, add rollback button (visible when `previous_version` exists)
- [x] Verify: TypeScript + Rust compile clean

## Phase 2: Unified Banner

**Acceptance**: Single banner handles both app + yt-dlp update checks. Auto-update mode installs silently. Manual mode shows banner with update button + settings hint.

- [x] `src/App.tsx` — Remove separate `UpdateBanner` and `YtdlpBanner`
- [x] `src/App.tsx` — Create unified `UpdateBanner` that:
  - Checks app update via `tauri-plugin-updater`
  - Checks yt-dlp version via `getYtdlpVersion` + GitHub API
  - If `auto_update` enabled: saves current version as rollback target, auto-downloads+installs
  - If `auto_update` disabled: show banner (app update = indigo, yt-dlp outdated = amber)
  - yt-dlp banner includes "enable auto-update in settings" hint
  - Dismissible with ✕ button
  - Before update, saves current version to config as `previous_version`
- [x] Verify: TypeScript compiles clean

## Phase 3: GH Action

**Acceptance**: Daily workflow checks yt-dlp, smoke tests, auto-releases with `v1.0.X-y.YYYY.MM.DD` tag on success, opens issue on failure

- [x] `yt-dlp-version.txt` — Create file with current bundled yt-dlp version (2026.03.03)
- [x] `.github/workflows/update-ytdlp.yml` — Create workflow:
  - Cron daily + manual dispatch
  - Manual dispatch inputs: `action` (update | rollback)
  - **Update mode**: compare versions → download → smoke test (--version + metadata extraction) → bump patch → tag `v1.0.X-y.YYYY.MM.DD` → push
  - **Rollback mode**: read `yt-dlp-version-prev.txt` → download previous → bump patch → tag → push
  - Failure: opens GitHub issue
- [ ] Verify: manually trigger workflow in both update and rollback modes

## Final Checklist

- [x] All TypeScript compiles (`npx tsc --noEmit`)
- [x] Rust compiles (`cargo check`)
- [x] No security issues introduced
- [ ] GH Action workflow syntax valid (needs manual trigger to verify)
