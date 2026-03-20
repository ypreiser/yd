# Plan: Performance

**Date**: 2026-03-18
**Status**: Approved
**Author**: Claude + user

## Context

YD emits progress events from Rust on every yt-dlp stdout line matching `\[download\]\s+([\d.]+)%`. yt-dlp outputs progress multiple times per second. With 5 concurrent downloads, this means dozens of events/sec.

Each event hits `onDownloadProgress` in `App.tsx:173` which calls `setDownloads(prev => new Map(prev))` — copying the entire Map and triggering a full re-render of every `DownloadItem`. Items aren't memoized, so all 50 cards re-render on every single progress tick from any download.

**Current hot path:**
1. Rust: yt-dlp stdout line → regex match → `app.emit()` (no throttle) — `download.rs:542-561`
2. JS: Tauri event → `setDownloads` → new Map copy → re-render all items — `App.tsx:174-197`
3. React: `DownloadItem` not wrapped in `React.memo`, re-renders unconditionally — `DownloadItem.tsx:26`

## Goal

Reduce unnecessary renders and IPC overhead during active downloads. Target: smooth 60fps UI even with 10+ concurrent items.

## Approach

Two-layer throttling:

1. **Rust-side**: Throttle `download-progress` emissions to max 1 per 200ms per download (using `tokio::time::Instant`). Always emit status changes (queued→downloading→converting→done/error) immediately.
2. **React-side**: Memoize `DownloadItem` with `React.memo` so only the item whose data changed re-renders. Move `statusLabels` to module scope.

Optional (Phase 2): Virtualize download list with `react-window` for 50+ item batches.

## Alternatives Considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| JS-side throttle only (requestAnimationFrame / debounce) | No Rust changes | Still copies Map on every event, IPC overhead remains | Doesn't fix root cause |
| Rust-side throttle only | Reduces IPC volume | React still re-renders all items on each event | Incomplete fix |
| Both Rust throttle + React.memo | Minimal IPC + minimal re-renders | Slightly more code | **Chosen — best of both** |
| useReducer + immer | Avoids Map copy | New dep (immer), more complexity | Overkill; memo solves the render issue |

## Scope

### In Scope

- Throttle progress events in Rust (200ms interval per download)
- `React.memo` on `DownloadItem`
- Move `statusLabels` to module scope in `DownloadItem`
- Optional: `react-window` for virtualizing long lists

### Out of Scope

- Download queue persistence
- Concurrent search cancellation
- Any UX/visual changes

## Affected Areas

- **Files**: `src-tauri/src/download.rs`, `src/components/DownloadItem.tsx`, `src/components/DownloadList.tsx`
- **Dependencies**: none (Phase 1), `react-window` + `@types/react-window` (Phase 2, optional)
- **Tests**: verify progress still updates visibly, no stale UI
- **Docs**: none

## Risks

- 200ms throttle could make progress bar feel choppy — mitigate with CSS `transition-all duration-300` already on the bar
- `React.memo` shallow comparison must match: `DownloadProgress` is a plain object from Tauri events, so shallow compare works
- Virtualization (Phase 2) breaks `animate-fade-in` on new items unless handled — can skip if list stays under ~100 items

## Phases

1. **Rust throttle + React memo** — throttle emissions, memoize DownloadItem, hoist static objects
2. **Virtualization** (optional) — add `react-window` FixedSizeList to DownloadList for 50+ items

## Open Questions

- [x] 200ms throttle interval OK, or prefer 100ms/300ms? → **200ms confirmed**
- [x] Want virtualization (Phase 2) now, or defer until batch use is common? → **Deferred**
