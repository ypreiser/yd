# YD — Code Review Report

**Project:** YD (YouTube Song Downloader)
**Date:** 2026-03-18
**Scope:** Rust backend (`src-tauri/`) + React/TypeScript frontend (`src/`)
**Review ID:** CR-001 (Initial Review)

---

## Regression & Fix Verification

> **First review — no prior report exists.** This section will be populated in subsequent reviews.

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

#### #3 — Platform-Specific Update URL Hardcoded to `.exe`

- **Category:** Security
- **File:** `src-tauri/src/download.rs:260-263`
- **Description:** `update_ytdlp` always downloads `yt-dlp.exe`, so on macOS/Linux it replaces a working binary with a non-functional Windows one.
- **Recommendation:** Use platform-conditional URLs and set execute permissions on Unix:

```rust
let download_url = if cfg!(windows) {
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
} else if cfg!(target_os = "macos") {
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
} else {
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
};

// After writing, on Unix:
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| e.to_string())?;
}
```

---

### High

#### #4 — Path Traversal via Crafted Video Title

- **Category:** Security
- **File:** `src-tauri/src/download.rs:475`
- **Description:** Output template `format!("{}/%(title)s.%(ext)s", config.download_dir)` passes download dir to yt-dlp. `--windows-filenames` is present but on Unix a crafted `../` title could write outside the download dir.
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

#### #6 — Version Comparison Uses Lexicographic Ordering

- **Category:** Bugs & Logic
- **File:** `src-tauri/src/download.rs:240`
- **Description:** `latest > current` uses string comparison. Works for same-length date strings (e.g. `2025.01.15`) but breaks if format varies (e.g. `2025.1.15` vs `2025.01.15`).
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

#### #8 — `download_batch` Aborts on First Error

- **Category:** Performance
- **File:** `src-tauri/src/download.rs:640-654`
- **Description:** Sequential processing with `?` means if any URL fails validation, the entire batch aborts, leaving already-started downloads orphaned from the response.
- **Recommendation:** Validate all URLs upfront before starting any downloads:

```rust
#[tauri::command]
pub async fn download_batch(
    app: tauri::AppHandle,
    urls: Vec<String>,
) -> Result<Vec<String>, String> {
    let urls: Vec<String> = urls.iter()
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty())
        .collect();
    // Validate all URLs first
    for url in &urls {
        if !is_valid_youtube_url(url) {
            return Err(format!("Invalid URL: {}", url));
        }
    }
    let mut ids = Vec::with_capacity(urls.len());
    for url in urls {
        let id = download(app.clone(), url).await?;
        ids.push(id);
    }
    Ok(ids)
}
```

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

#### #14 — Duplicated `isPlaylistUrl` Function

- **Category:** Maintainability
- **File:** `src/components/SearchBar.tsx:24-27` & `src/components/UrlInput.tsx:12-14`
- **Description:** Identical `isPlaylistUrl` implementations in both files.
- **Recommendation:** Extract to `src/lib/youtube.ts`:

```typescript
export function isPlaylistUrl(url: string): boolean {
  return /[?&]list=/.test(url)
    || /\/playlist\?/.test(url)
    || /\/(channel|c|@)[/\w]/.test(url);
}
```

---

### Low

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
| High      | 4      |
| Medium    | 7      |
| Low       | 6      |
| **Total** | **20** |

### Priority Remediation Order

1. **#1** CSP disabled — immediate, minimal effort
2. **#2** Unverified binary download — high priority, moderate effort
3. **#3** Platform-specific update URL — high priority, low effort
4. **#7** Deadlock risk — high priority, low effort
5. **#5** Config validation — high priority, low effort
6. **#4** Path traversal — high priority, one-line fix
7. **#11** PID 0 kill — medium priority, low effort
8. **#10** Unix kill semantics — medium priority, low effort
9. **#9** Search query sanitization — medium priority, low effort
10. Remaining issues in severity order

---

_Report generated: 2026-03-18 | Review ID: CR-001_
