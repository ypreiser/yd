# TODO: Performance

**Plan**: [link to plan doc](./2026-03-18-performance-plan.md)
**Date**: 2026-03-18
**Status**: In Progress

## Phase 1: Rust-side throttle

**Acceptance**: Progress events emit at most once per 200ms per download. Status changes (queued, downloading, converting, done, error, cancelled) always emit immediately.

- [x] `src-tauri/src/download.rs` — Add `use tokio::time::Instant;` import
- [x] `src-tauri/src/download.rs` — In the progress-reading loop (~line 529), add a `last_emit: Instant` tracker. Only call `app.emit()` for percent updates if 200ms elapsed since last emit. Always emit on status change (title discovery, converting, done, error, cancelled).
- [ ] Verify: start a download, confirm progress bar still updates smoothly, final done/error state always arrives

## Phase 2: React-side memo

**Acceptance**: Only the `DownloadItem` whose data changed re-renders. Other items stay stable.

- [x] `src/components/DownloadItem.tsx` — Wrap component with `memo()`: `export default memo(DownloadItem)`
- [x] `src/components/DownloadItem.tsx` — Replace inline `statusLabels` with module-scope `STATUS_KEYS` map + `t[STATUS_KEYS[status]]` lookup
- [ ] Verify: with React DevTools Profiler or console.log, confirm only the active download's card re-renders during progress ticks

## Final Checklist

- [ ] Progress bar animates smoothly (CSS `transition-all duration-300` bridges 200ms gaps)
- [ ] All status transitions visible (queued → downloading → converting → done)
- [ ] Cancel still works and updates immediately
- [ ] Error state renders immediately
- [ ] No regressions in RTL or dark/light theme
