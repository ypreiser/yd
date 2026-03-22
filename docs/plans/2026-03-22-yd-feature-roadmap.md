# Spec: YD — UX Quick Wins & Robustness

**Date**: 2026-03-22 **Status**: Approved **Author**: Claude + user **Slug**: yd-feature-roadmap

---

## Plan

### Context

YD is a working Tauri v2 YouTube audio downloader (React + Rust + yt-dlp). The initial build plan ([2026-03-12-yt-dlp-tauri-app-plan.md](./2026-03-12-yt-dlp-tauri-app-plan.md)) is fully complete. The app supports single/batch downloads, YouTube search, playlist support, i18n (en/he), dark/light theme, auto-update, and yt-dlp binary management.

This plan covers the UX Quick Wins and Robustness items from [plan.md](./plan.md).

### Goal

Add quality-of-life UX improvements (drag & drop, retry, clear, paste, open folder) and robustness fixes (disk space check, search cancellation) to make YD feel polished and reliable.

### Approach

- **Frontend-heavy**: most UX wins are React component changes using browser APIs (Clipboard, DnD) and existing Tauri plugins (opener)
- **Backend additions**: new Rust commands for disk space check and open-folder; search cancellation via process management
- **No new crate dependencies**: disk space via `std::fs` metadata + platform API; open folder via existing `tauri-plugin-opener`

### Scope

**In:**

- Drag & drop URLs onto window
- "Open folder" button after download completes
- Clear finished downloads button
- Download error retry button
- Paste button next to URL input
- Disk space check before large batches
- Cancel stale search when new search starts

**Out:**

- Download history persistence
- System notifications
- Audio preview
- Open in browser button
- User config (title/thumbnail/metadata/HE flip)
- Everything else from "Features Worth Adding" in plan.md

### Affected Areas

- **Files**:
  - `src-tauri/src/download.rs` — search cancellation, disk space check command
  - `src-tauri/src/lib.rs` — register new commands
  - `src/components/UrlInput.tsx` — drag & drop, paste button
  - `src/components/DownloadItem.tsx` — retry button, open folder button
  - `src/components/DownloadList.tsx` — clear finished button
  - `src/components/SearchBar.tsx` — cancel previous search
  - `src/App.tsx` — minor wiring (retry handler)
  - `src/lib/tauri.ts` — new command wrappers
  - `src/lib/i18n.tsx` — new translation keys
- **Dependencies**: None new
- **Tests**: Manual verification
- **Docs**: Update plan.md checklist items

### Risks

- **Disk space check**: Platform-specific. Mitigation: use Windows `GetDiskFreeSpaceExW` via `std`; graceful fallback if check fails (warn but don't block).
- **Search cancellation**: Need to track child process ID. Mitigation: store PID in state, kill on new search; if kill fails, let old process finish silently.

### Phases

1. **UX Quick Wins** — Drag & drop, paste button, clear finished, open folder, retry button
2. **Robustness** — Disk space check, search cancellation

### Open Questions

- [ ] Disk space threshold: warn at <500MB? <1GB? Configurable?

---

## Revision Log

### Revision 1 — 2026-03-22

**Feedback**: Limit scope to UX Quick Wins and Robustness only
**Decision**: Removed phases 3-5 (Config & Metadata, History Persistence, Notifications & Preview). Scope now covers only the 7 items from UX Quick Wins + Robustness sections of plan.md.

---

## TODO

**Status**: Done

### Phase 1: UX Quick Wins

**Acceptance**: All 5 UX features work end-to-end. Drag URLs onto window → they appear in textarea. Paste button reads clipboard. Clear button removes finished items. Retry re-downloads failed items. Open folder opens download dir after completion.

#### 1a. Drag & Drop URLs

- [x] `src/components/UrlInput.tsx` — Fix `onDrop` handler: call `e.preventDefault()`, read `e.dataTransfer.getData("text")`, extract URLs and append to textarea value
- [x] Verify: drag text containing YouTube URLs from browser onto textarea → URLs populate

#### 1b. Paste Button

- [x] `src/components/UrlInput.tsx` — Add paste button next to download button. On click, read `navigator.clipboard.readText()` and append to textarea
- [x] `src/lib/i18n.tsx` — Add `paste` key to `Translations` interface + both `en`/`he` objects
- [x] Verify: click paste → clipboard text appears in textarea

#### 1c. Clear Finished Downloads

- [x] `src/components/DownloadList.tsx` — Add `onClear` prop + "Clear finished" button (visible only when finished items exist)
- [x] `src/App.tsx` — Add `handleClear` callback: filter `downloads` map to remove items with status done/error/cancelled
- [x] `src/lib/i18n.tsx` — Add `clearFinished` key
- [x] Verify: complete downloads → click clear → only active items remain

#### 1d. Open Folder Button

- [x] `src/components/DownloadItem.tsx` — Add folder icon button (visible when status=done). On click calls `getConfig()` then `openPath(download_dir)` via `@tauri-apps/plugin-opener`
- [x] `src/lib/i18n.tsx` — Add `openFolder` key
- [x] Verify: download completes → folder button appears → click opens download directory in file explorer

#### 1e. Retry Failed Downloads

- [x] `src/components/DownloadItem.tsx` — Accept `onRetry` prop. Add retry button (visible when status=error). On click call `onRetry(item.url)`
- [x] `src/components/DownloadList.tsx` — Accept `onRetry` prop, pass to each `DownloadItem`
- [x] `src/App.tsx` — Pass `onRetry` to `DownloadList` that calls `downloadBatch([url])`
- [x] `src/lib/i18n.tsx` — Add `retry` key
- [ ] Verify: download fails → retry button appears → click re-downloads the URL as a new item

### Phase 2: Robustness

**Acceptance**: Disk space warning shows before large batches on low disk. Starting a new search cancels the previous in-progress search.

#### 2a. Disk Space Check

- [x] `src-tauri/src/download.rs` — Add `check_disk_space(path: String) -> Result<u64, String>` command using `GetDiskFreeSpaceExW` on Windows, `statvfs` on Unix
- [x] `src-tauri/src/lib.rs` — Register `check_disk_space` command
- [x] `src/lib/tauri.ts` — Add `checkDiskSpace(path: string): Promise<number>` wrapper
- [x] `src/App.tsx` — Before calling `downloadBatch`, check disk space. If < 500MB, show `window.confirm` warning. Don't block, just warn.
- [x] `src/lib/i18n.tsx` — Add `lowDiskSpace` key
- [ ] Verify: set download dir to drive with <500MB free → start batch → warning appears

#### 2b. Search Cancellation

- [x] `src-tauri/src/download.rs` — Add `SearchState` with `Arc<Mutex<Option<u32>>>` to track current search PID. In `search_youtube`, store PID before awaiting, clear on finish. Add `cancel_search` command that kills the stored PID. Auto-cancels previous search on new search.
- [x] `src-tauri/src/lib.rs` — Register `cancel_search`, manage `SearchState`
- [x] `src/lib/tauri.ts` — Add `cancelSearch()` wrapper
- [x] `src/components/SearchBar.tsx` — Before starting a new search, call `cancelSearch()` to kill any in-progress search. Ignore errors.
- [x] Verify: start a search → immediately start another → first search process is killed, second completes normally

---

## Final Checklist

**General**

- [x] All 5 UX features implemented (drag & drop, paste, clear, open folder, retry)
- [x] Both robustness features implemented (disk space, search cancel)
- [x] i18n keys added for both en and he
- [x] No regressions in existing features (manual verify)

**Security**

- [x] No secrets or credentials in code
- [x] Clipboard read only on user action (paste button click)
- [x] No new attack surface
