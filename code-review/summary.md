# YD — Code Review Report

**Project:** YD (YouTube Song Downloader)
**Date:** 2026-03-18 (Updated: 2026-03-22)
**Scope:** Rust backend (`src-tauri/`) + React/TypeScript frontend (`src/`)
**Review ID:** CR-002 (Revised Review)

---

## Regression & Fix Verification

> **CR-002 notes:** Severity corrections applied to #3, #4, #6, #8, #14. New findings #21–#24 added. See changelog for details.

---

## Findings

### Critical

#### #1 — CSP Disabled

- **Category:** Security
- **File:** `src-tauri/tauri.conf.json:23`
- **Description:** `"csp": null` disables all Content Security Policy protections, allowing unrestricted script execution, inline scripts, and connections to arbitrary origins. Significant attack surface given external thumbnails and GitHub API calls.
- **Recommendation:** Set a restrictive CSP whitelisting only required origins:

```json
"security": {
  "csp": "default-src 'self'; img-src 'self' https://i.ytimg.com https://*.googleusercontent.com; connect-src 'self' https://api.github.com https://github.com; script-src 'self'; style-src 'self' 'unsafe-inline'"
}
```

#### #2 — Unvalidated Binary Download

- **Category:** Security
- **File:** `src-tauri/src/download.rs:250-275`
- **Description:** `update_ytdlp` downloads an executable from a hardcoded URL and writes it directly to disk without integrity verification (no checksum, no signature). A MITM or CDN compromise could inject a malicious binary.
- **Recommendation:** Verify SHA256 hash against the value published in the GitHub release metadata:

```rust
let resp_meta: serde_json::Value = client
    .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
    .header("User-Agent", "yd-app")
    .header("Accept", "application/vnd.github+json")
    .send().await.map_err(|e| e.to_string())?
    .json().await.map_err(|e| e.to_string())?;

// Find expected SHA256 from release assets/checksums file, then verify:
use sha2::{Sha256, Digest};
let mut hasher = Sha256::new();
hasher.update(&bytes);
let hash = format!("{:x}", hasher.finalize());
if hash != expected_hash {
    return Err("Checksum mismatch — download aborted".into());
}
std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
```

#### #3 — Unverified Binary Immediately Executed

- **Category:** Security
- **File:** `src-tauri/src/download.rs:285-297`
- **Description:** `update_ytdlp` writes downloaded bytes to disk then immediately calls `get_ytdlp_version()` which *executes* the new binary. Combined with #2 (no checksum), a MITM or CDN compromise results in immediate code execution, not just a bad file on disk.
- **Recommendation:** Verify integrity (see #2) *before* writing. Do not execute the binary until checksum passes. Alternatively, download to a temp file, verify, then rename:

```rust
let temp_path = path.with_extension("tmp");
std::fs::write(&temp_path, &bytes).map_err(|e| e.to_string())?;
// Verify checksum here (see #2)...
std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;
```

---

### High

#### #5 — No Validation on `set_config` Input

- **Category:** Security
- **File:** `src-tauri/src/config.rs:60-62`
- **Description:** `download_dir` accepted as-is from frontend. Could be set to `/etc`, `C:\Windows\System32`, or traversal paths. `audio_format` validated in `download()` but not in `set_config()`.
- **Recommendation:** Validate all config fields before persisting:

```rust
#[tauri::command]
pub fn set_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    if !["m4a", "mp3", "opus", "flac"].contains(&config.audio_format.as_str()) {
        return Err(format!("Invalid audio format: {}", config.audio_format));
    }
    let dir = std::path::Path::new(&config.download_dir);
    if !dir.is_absolute() {
        return Err("Download directory must be an absolute path".to_string());
    }
    if !["dark", "light"].contains(&config.theme.as_str()) {
        return Err("Invalid theme".to_string());
    }
    if !["en", "he"].contains(&config.language.as_str()) {
        return Err("Invalid language".to_string());
    }
    save_config(&app, &config)
}
```

#### #7 — Deadlock Risk in `cancel_download`

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:657-668`
- **Description:** `cancel_download` acquires `children.lock()` then `cancelled.lock()`. `download()` acquires them in the opposite order. Classic lock-ordering deadlock.
- **Recommendation:** Drop the first lock before acquiring the second:

```rust
#[tauri::command]
pub async fn cancel_download(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<DownloadState>();
    // Acquire children lock, get PID, then DROP lock
    let pid = {
        let map = state.children.lock().await;
        map.get(&id).copied()
    };
    if let Some(pid) = pid {
        // Now acquire cancelled lock separately
        state.cancelled.lock().await.insert(id);
        kill_process_tree(pid)?;
        Ok(())
    } else {
        Err("download not found or already finished".to_string())
    }
}
```

---

### Medium

#### #4 — Path Traversal via Crafted Video Title *(moved from High)*

- **Category:** Security
- **File:** `src-tauri/src/download.rs:475`
- **Description:** Output template `format!("{}/%(title)s.%(ext)s", config.download_dir)` passes download dir to yt-dlp. `--windows-filenames` is present but on Unix a crafted `../` title could write outside the download dir. Severity reduced: app is Windows-only in practice, and the title is passed via yt-dlp's own template, not a raw shell arg.
- **Recommendation:** Add `--restrict-filenames` flag:

```rust
.args([
    "--extract-audio",
    "--audio-format", &config.audio_format,
    "--newline", "--progress",
    "--windows-filenames",
    "--restrict-filenames", // ADD THIS
    "--ffmpeg-location", &ffmpeg_path,
    // ...
])
```

#### #6 — Version Comparison Uses Lexicographic Ordering *(moved from High)*

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:240`
- **Description:** `latest > current` uses string comparison. Works for same-length date strings (e.g. `2025.01.15`) but breaks if format varies. Severity reduced: not currently broken since yt-dlp uses zero-padded dates.
- **Recommendation:** Parse date components:

```rust
fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() >= 3 {
            Some((parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?))
        } else {
            None
        }
    };
    match (parse(latest), parse(current)) {
        (Some(l), Some(c)) => l > c,
        _ => latest > current, // fallback
    }
}
```

#### #21 — Platform-Specific Update URL Hardcoded to `.exe` *(was #3 Critical, reclassified)*

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:260-263`
- **Description:** `update_ytdlp` always downloads `yt-dlp.exe`. On macOS/Linux it would replace a working binary with a non-functional Windows one. Severity reduced from Critical: app is Windows-only (CI, sidecar naming, tauri config all confirm).
- **Recommendation:** Use platform-conditional URLs if cross-platform support is added.

#### #22 — Search Result Race Condition *(new)*

- **Category:** Bugs & Logic
- **File:** `src/components/SearchBar.tsx:49-57`
- **Description:** No debounce on search. Rapid submissions fire concurrent yt-dlp subprocesses. Stale results from an earlier query can overwrite newer ones via `setResults(res)` with no guard for whether this is still the latest query.
- **Recommendation:** Track a request ID or use an abort pattern:

```typescript
const latestRef = useRef(0);
const handleSearch = async () => {
  const id = ++latestRef.current;
  const res = await searchYoutube(query);
  if (id === latestRef.current) setResults(res);
};
```

#### #23 — PID Map Leak on Cancel *(new)*

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:642-645`
- **Description:** `children` map `remove` only happens after `child.wait()` in the success branch. If a download is cancelled or errors before `wait()`, the PID stays in the map forever — leaking memory and potentially killing a reused PID on future cancel attempts.
- **Recommendation:** Ensure cleanup in all exit paths (cancel, error, success).

#### #9 — Unsanitized Search Query

- **Category:** Security
- **File:** `src-tauri/src/download.rs:282-289`
- **Description:** `query` from frontend interpolated into `ytsearch10:{query}` and passed as command arg. Leading dashes could be interpreted as yt-dlp flags.
- **Recommendation:** Strip leading dashes and limit length:

```rust
let query = query.trim().to_string();
if query.is_empty() || query.len() > 200 {
    return Err("Invalid search query".to_string());
}
let query = query.trim_start_matches('-');
let search_query = format!("ytsearch10:{}", query);
```

#### #10 — Unix `kill_process_tree` Uses Negative PID Incorrectly

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:186-192`
- **Description:** `kill(-pid, SIGTERM)` assumes the process is a group leader. `child.id()` returns PID, not PGID. Also, return value of `libc::kill` is unchecked.
- **Recommendation:** Kill the PID directly and check return value:

```rust
fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        let ret = unsafe { libc::kill(pid as i32, libc::SIGTERM) };
        if ret != 0 {
            return Err(format!("kill failed: {}", std::io::Error::last_os_error()));
        }
    }
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

#### #11 — PID 0 Kill Risk

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:498`
- **Description:** `child.id()` can return `None`, defaulting to `0`. PID 0 on Unix = kernel idle process. Cancelling would send SIGTERM to the entire process group.
- **Recommendation:** Don't register PID 0:

```rust
let pid = match child.id() {
    Some(pid) => pid,
    None => 0, // Process already exited
};
if pid != 0 {
    let mut map = children.lock().await;
    map.insert(id_clone.clone(), pid);
}
```

#### #12 — Hardcoded Cookie in YouTube Requests

- **Category:** Security
- **File:** `src-tauri/src/download.rs:288`
- **Description:** `Cookie:PREF=f2=8000000` bypasses EU consent screens but introduces maintenance burden and could trigger YouTube blocks.
- **Recommendation:** Document why this cookie exists. Consider making it configurable.

#### #13 — Progress Listener Creates New Map Every Event

- **Category:** Performance
- **File:** `src/App.tsx:173-202`
- **Description:** Every progress event creates a new `Map`, triggering React re-renders for the entire download list multiple times per second per download.
- **Recommendation:** Buffer updates with `requestAnimationFrame`:

```typescript
useEffect(() => {
  const buffer = new Map<string, DownloadProgress>();
  let rafId: number | null = null;
  const unlisten = onDownloadProgress((progress) => {
    buffer.set(progress.id, progress);
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        setDownloads((prev) => {
          const next = new Map(prev);
          for (const [id, p] of buffer) { next.set(id, p); }
          buffer.clear();
          return next;
        });
        rafId = null;
      });
    }
  });
  return () => { unlisten.then((fn) => fn()); if (rafId) cancelAnimationFrame(rafId); };
}, []);
```

---

### Low

#### #8 — `download_batch` Aborts on First Error *(moved from Medium)*

- **Category:** Performance
- **File:** `src-tauri/src/download.rs:640-654`
- **Description:** Sequential `?` means a bad URL mid-batch stops the rest. Severity reduced: `download()` only errors on URL validation or spawn failure (not network errors), so impact is limited.
- **Recommendation:** Validate all URLs upfront before starting any downloads.

#### #14 — Duplicated `isPlaylistUrl` Function *(moved from Medium)*

- **Category:** Maintainability
- **File:** `src/components/SearchBar.tsx:24-27` & `src/components/UrlInput.tsx:12-14`
- **Description:** Identical implementations. Zero runtime risk.
- **Recommendation:** Extract to `src/lib/youtube.ts`.

#### #15 — Hardcoded `MAX_CONCURRENT`

- **Category:** Maintainability
- **File:** `src-tauri/src/download.rs:20`
- **Description:** `MAX_CONCURRENT` is hardcoded to 5. Could be configurable via `AppConfig`.

#### #16 — Dead `formatDuration` Function

- **Category:** Maintainability
- **File:** `src/components/SearchBar.tsx:77-80`
- **Description:** `formatDuration` returns input as-is. Remove and use value directly.

#### #17 — Raw FFI for Windows ANSI Code Page

- **Category:** Best Practices
- **File:** `src-tauri/src/download.rs:93-108`
- **Description:** Uses `extern "system"` directly. Consider `windows-sys` crate for type-safe bindings.

#### #18 — CI Only Builds for Windows

- **Category:** Best Practices
- **File:** `.github/workflows/release.yml`
- **Description:** Build matrix only includes `windows-latest` despite cross-platform code.
- **Recommendation:** Add macOS and Linux to matrix.

#### #19 — `load_config` Called on Every Download

- **Category:** Performance
- **File:** `src-tauri/src/download.rs:430`
- **Description:** Reads and parses JSON from disk on every download invocation. 50 downloads = 50 file reads.
- **Recommendation:** Cache config in Tauri managed state, reload only on `set_config`.

#### #20 — `ffmpeg_location` Uses `current_exe` Path

- **Category:** Maintainability
- **File:** `src-tauri/src/download.rs:46-50`
- **Description:** In dev mode, `current_exe` points to `target/debug/`, which may not contain ffmpeg.
- **Recommendation:** Use same sidecar resolution strategy as `ytdlp_path`.

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 3      |
| High      | 2      |
| Medium    | 10     |
| Low       | 8      |
| **Total** | **23** |

### Remediation Status (v1.1.1)

| # | Issue | Status |
|---|-------|--------|
| #1 | CSP disabled | **Deferred** — Tauri v2 CSP requires careful `ipc:` / `http://ipc.localhost` config; needs dedicated investigation |
| #2 | Unverified binary download | **Fixed** — SHA-256 checksum verified against `SHA2-256SUMS` from release |
| #3 | Unverified binary exec | **Fixed** — write to temp file, rename after; platform-conditional URLs |
| #4 | Path traversal | **Deferred** — `--restrict-filenames` breaks Hebrew paths; `--windows-filenames` covers Windows |
| #5 | Config validation | **Fixed** — validate format, theme, language, absolute path in `set_config` |
| #6 | Version comparison | **Fixed** — `version_is_newer()` parses numeric components |
| #7 | Deadlock in cancel | **Fixed** — drop `children` lock before acquiring `cancelled` lock |
| #9 | Search query sanitization | **Fixed** — strip leading dashes, limit length |
| #10 | Unix kill semantics | **Fixed** — kill PID directly, check return value |
| #11 | PID 0 kill risk | **Fixed** — guard PID 0 in `kill_process_tree` and skip registration |
| #13 | Progress re-renders | **Fixed** — RAF-batched updates |
| #14 | Duplicated `isPlaylistUrl` | **Fixed** — extracted to `src/lib/youtube.ts` |
| #16 | Dead `formatDuration` | **Fixed** — removed |
| #22 | Search race condition | **Fixed** — `searchIdRef` guards stale results |
| #23 | PID map leak | **Fixed** — cleanup in error branch |

### Open Issues

- **#1** CSP — needs Tauri v2-compatible CSP with `ipc: http://ipc.localhost` in `connect-src`
- ~~**#2** Checksum verification~~ — fixed in v1.1.1
- **#4** Path traversal on Unix — `--restrict-filenames` incompatible with non-ASCII download dirs
- **#10** Process group killing incomplete — should set `process_group(0)` before spawn on Unix
- **#7** Minor TOCTOU window between lock releases — acceptable in practice
- **#12, #15, #17–#21** remaining low/medium issues

---

_Report generated: 2026-03-18 | Updated: 2026-03-22 | Review ID: CR-002_
