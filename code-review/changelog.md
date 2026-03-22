# Code Review — Change Log

---

## v1.1.1 Fixes — 2026-03-22

### Issues Fixed

| # | Issue | Fix |
|---|-------|-----|
| #3 | Unverified binary exec | Write to temp, rename; platform-conditional URLs; Unix permissions |
| #5 | Config validation | Validate format, theme, language, absolute path in `set_config` |
| #6 | Version comparison | `version_is_newer()` parses numeric date components |
| #7 | Deadlock in cancel | Drop `children` lock before acquiring `cancelled` lock |
| #9 | Search query sanitization | Strip leading dashes, limit to 200 chars |
| #10 | kill_process_tree | Guard PID 0, check return value, kill PID directly |
| #11 | PID 0 kill risk | Skip PID 0 in `kill_process_tree` and `children` map registration |
| #13 | Progress re-renders | RAF-batched event updates |
| #14 | Duplicated `isPlaylistUrl` | Extracted to `src/lib/youtube.ts` |
| #16 | Dead `formatDuration` | Removed |
| #22 | Search race condition | `searchIdRef` guards stale results |
| #23 | PID map leak | Cleanup in spawn error branch |

### Issues Deferred

| # | Issue | Reason |
|---|-------|--------|
| #1 | CSP | Tauri v2 requires `ipc: http://ipc.localhost` in `connect-src`; needs dedicated investigation |
| #2 | Checksum verification | Requires fetching + parsing GitHub release checksums |
| #4 | Path traversal | `--restrict-filenames` breaks non-ASCII download directory paths |

### Files Changed

| File | Changes |
|------|---------|
| `src-tauri/src/download.rs` | #3, #6, #7, #9, #10, #11, #22, #23 |
| `src-tauri/src/config.rs` | #5 |
| `src/App.tsx` | #13 |
| `src/components/SearchBar.tsx` | #14, #16, #22 |
| `src/components/UrlInput.tsx` | #14 |
| `src/lib/youtube.ts` | #14 (new file) |
| `code-review/summary.md` | Updated remediation status |
| `code-review/changelog.md` | Added fix log |

---

## CR-002 — 2026-03-22

### Actions Taken

| File                       | Action       | Description                                      |
| -------------------------- | ------------ | ------------------------------------------------ |
| `code-review/summary.md`   | **Updated**  | Severity corrections, new findings, revised notes |
| `code-review/changelog.md` | **Updated**  | Added CR-002 entry                               |

### Changes

| Change                          | Details                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| #3 replaced                     | Old #3 (platform URL, Critical) → reclassified as #21 (Medium). New #3: unverified binary immediately executed (Critical) |
| #4 downgraded                   | High → Medium. App is Windows-only; traversal surface narrower than stated                                                |
| #6 downgraded                   | High → Medium. Not currently broken (yt-dlp uses zero-padded dates)                                                       |
| #8 downgraded                   | Medium → Low. `download()` is nearly infallible at invocation level                                                       |
| #14 downgraded                  | Medium → Low. Zero runtime risk, pure maintainability                                                                     |
| #21 added                       | Platform URL (was #3), reclassified Medium                                                                                |
| #22 added (new)                 | Search result race condition — no debounce, stale results overwrite newer ones                                            |
| #23 added (new)                 | PID map leak on cancel — cancelled downloads never clean up from children map                                             |
| #10 fix flagged as incomplete   | Should also set `command.process_group(0)` before spawn                                                                  |
| #7 fix note added               | Minor TOCTOU window between lock releases                                                                                |
| Updater inconsistency noted     | Tauri app updater is signed, yt-dlp updater is not                                                                       |

### Findings Summary (Cumulative)

| Severity  | CR-001 | CR-002 | Delta |
| --------- | ------ | ------ | ----- |
| Critical  | 3      | 3      | #3 replaced (platform URL → exec after write) |
| High      | 4      | 2      | #4, #6 downgraded to Medium |
| Medium    | 7      | 10     | +#4, #6, #21, #22, #23; −#8, #14 |
| Low       | 6      | 8      | +#8, #14 |
| **Total** | **20** | **23** | **+3 net new** |

---

## CR-001 — 2026-03-18

### Actions Taken

| File                       | Action      | Description                              |
| -------------------------- | ----------- | ---------------------------------------- |
| `code-review/summary.md`   | **Created** | Initial comprehensive code review report |
| `code-review/changelog.md` | **Created** | This meta-documentation file             |

### Review Scope

- **Files analyzed:** 18 source files across Rust backend and React/TypeScript frontend
- **Lines reviewed:** ~2,200 lines of application code
- **Configuration files reviewed:** `tauri.conf.json`, `Cargo.toml`, `package.json`, `release.yml`, `capabilities/default.json`

### Findings Summary

| Action                     | Count | Details                                                                                                                                                                          |
| -------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Critical issues logged | 3     | CSP disabled (#1), unverified binary download (#2), wrong-platform binary update (#3)                                                                                            |
| New High issues logged     | 4     | Path traversal (#4), config validation (#5), version comparison bug (#6), deadlock risk (#7)                                                                                     |
| New Medium issues logged   | 7     | Batch error handling (#8), search query sanitization (#9), Unix kill semantics (#10), PID 0 risk (#11), hardcoded cookie (#12), render performance (#13), code duplication (#14) |
| New Low issues logged      | 6     | Hardcoded concurrency (#15), dead code (#16), unsafe FFI (#17), CI matrix (#18), config caching (#19), ffmpeg path (#20)                                                         |

---

_Generated: 2026-03-22_
