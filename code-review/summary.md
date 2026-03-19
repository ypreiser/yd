# YD — Comprehensive Code Review Report

**Project:** YD (YouTube Song Downloader)
**Date:** 2026-03-18
**Reviewer:** Senior Software Architect & Security Lead
**Scope:** Full codebase — Rust backend (`src-tauri/`) + React/TypeScript frontend (`src/`)
**Review ID:** CR-001 (Initial Review)

---

## Regression & Fix Verification

> **First review — no prior report exists.** This section will be populated in subsequent reviews to track resolved issues.

| Issue # | Original Finding | Status |
|---------|-----------------|--------|
| — | No prior review | N/A |

---

## New Findings

### Critical Severity

| # | Category | File | Description | Recommendation | Code Snippet |
|---|----------|------|-------------|----------------|--------------|
| 1 | **Security** | `src-tauri/tauri.conf.json:23` | **CSP is explicitly disabled** (`"csp": null`). This disables all Content Security Policy protections, allowing unrestricted script execution, inline scripts, and connections to arbitrary origins. In a Tauri app that loads external thumbnails and communicates with GitHub APIs, this is a significant attack surface. | Set a restrictive CSP that whitelists only required origins. | ```json "security": { "csp": "default-src 'self'; img-src 'self' https://i.ytimg.com https://*.googleusercontent.com; connect-src 'self' https://api.github.com https://github.com; script-src 'self'; style-src 'self' 'unsafe-inline'" } ``` |
| 2 | **Security** | `src-tauri/src/download.rs:250-275` | **Unvalidated binary download in `update_ytdlp`**. The function downloads an executable from a hardcoded URL and writes it directly to disk without any integrity verification (no checksum, no signature validation). A MITM or CDN compromise could inject a malicious binary that the app will subsequently execute with user privileges. | Verify the downloaded binary's SHA256 hash against the value published in the GitHub release metadata. At minimum, validate the HTTP response status and Content-Type before writing. | ```rust // After downloading bytes: let resp_meta: serde_json::Value = client .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest") .header("User-Agent", "yd-app") .header("Accept", "application/vnd.github+json") .send().await.map_err(|e| e.to_string())? .json().await.map_err(|e| e.to_string())?; // Find the SHA256 from release assets or checksums file // and verify: use sha2::{Sha256, Digest}; let mut hasher = Sha256::new(); hasher.update(&bytes); let hash = format!("{:x}", hasher.finalize()); if hash != expected_hash { return Err("Checksum mismatch — download aborted".into()); } std::fs::write(&path, &bytes).map_err(|e| e.to_string())?; ``` |
| 3 | **Security** | `src-tauri/src/download.rs:260-263` | **Platform-specific update URL hardcoded to `.exe` only**. The `update_ytdlp` command always downloads `yt-dlp.exe`, which means on macOS/Linux the function downloads a Windows binary. This will silently replace a working binary with a non-functional one. | Use platform-conditional download URLs. | ```rust let download_url = if cfg!(windows) { "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" } else if cfg!(target_os = "macos") { "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos" } else { "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" }; ``` Also, on Unix, set execute permissions after download: ```rust #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)) .map_err(|e| e.to_string())?; } ``` |

### High Severity

| # | Category | File | Description | Recommendation | Code Snippet |
|---|----------|------|-------------|----------------|--------------|
| 4 | **Security** | `src-tauri/src/download.rs:475` | **Path traversal via crafted video title**. The output template `format!("{}/%(title)s.%(ext)s", config.download_dir)` passes the download directory directly to yt-dlp. While yt-dlp has `--windows-filenames`, a crafted title containing `../` on Unix could write files outside the download directory. | Add `--restrict-filenames` flag or sanitize `config.download_dir` to ensure it's an absolute path, and validate that the resolved output path remains within the configured directory. | ```rust .args([ "--extract-audio", "--audio-format", &config.audio_format, "--newline", "--progress", "--windows-filenames", "--restrict-filenames", // ADD THIS "--ffmpeg-location", &ffmpeg_path, // ... ]) ``` |
| 5 | **Security** | `src-tauri/src/config.rs:60-62` | **No validation on `set_config` input**. The `download_dir` field is accepted as-is from the frontend without any validation. A malicious or buggy frontend could set `download_dir` to sensitive paths like `/etc`, `C:\Windows\System32`, or paths containing traversal sequences. The `audio_format` field is validated in `download()` but not in `set_config()`, creating inconsistency. | Validate config fields before persisting. | ```rust #[tauri::command] pub fn set_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> { // Validate audio format if !["m4a", "mp3", "opus", "flac"].contains(&config.audio_format.as_str()) { return Err(format!("Invalid audio format: {}", config.audio_format)); } // Validate download_dir is an absolute path let dir = std::path::Path::new(&config.download_dir); if !dir.is_absolute() { return Err("Download directory must be an absolute path".to_string()); } // Validate theme and language if !["dark", "light"].contains(&config.theme.as_str()) { return Err("Invalid theme".to_string()); } if !["en", "he"].contains(&config.language.as_str()) { return Err("Invalid language".to_string()); } save_config(&app, &config) } ``` |
| 6 | **Bugs & Logic** | `src-tauri/src/download.rs:240` | **Version comparison uses lexicographic string ordering** (`latest > current`). yt-dlp versions are date-based (e.g., `2025.01.15`), where string comparison happens to work for same-length strings. However, if the format ever changes (e.g., `2025.1.15` vs `2025.01.15`), this comparison breaks silently. | Use a proper version comparison or parse the date components. | ```rust fn version_is_newer(latest: &str, current: &str) -> bool { // yt-dlp uses YYYY.MM.DD format let parse = |v: &str| -> Option<(u32, u32, u32)> { let parts: Vec<&str> = v.split('.').collect(); if parts.len() >= 3 { Some(( parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?, )) } else { None } }; match (parse(latest), parse(current)) { (Some(l), Some(c)) => l > c, _ => latest > current, // fallback } } ``` |
| 7 | **Bugs & Logic** | `src-tauri/src/download.rs:657-668` | **Deadlock risk in `cancel_download`**. The function acquires `children.lock()` and then while still holding it, acquires `cancelled.lock()`. In `download()`, the spawned task acquires `cancelled.lock()` (line 581) and `children.lock()` (line 614) in the opposite order. This is a classic lock-ordering deadlock. | Always acquire locks in a consistent order, or restructure to avoid holding both simultaneously. | ```rust #[tauri::command] pub async fn cancel_download(app: tauri::AppHandle, id: String) -> Result<(), String> { let state = app.state::<DownloadState>(); // Acquire children lock, get PID, then drop lock let pid = { let map = state.children.lock().await; map.get(&id).copied() }; if let Some(pid) = pid { // Now acquire cancelled lock separately state.cancelled.lock().await.insert(id); kill_process_tree(pid)?; Ok(()) } else { Err("download not found or already finished".to_string()) } } ``` |

### Medium Severity

| # | Category | File | Description | Recommendation | Code Snippet |
|---|----------|------|-------------|----------------|--------------|
| 8 | **Performance** | `src-tauri/src/download.rs:640-654` | **`download_batch` processes URLs sequentially**, awaiting each `download()` call. Since `download()` only spawns a task and returns an ID, the `await` is fast, but the sequential URL validation and config loading is repeated N times. More importantly, if any URL fails validation, the entire batch is aborted with `?`, leaving previously-started downloads orphaned from the response. | Collect all results and return partial successes, or validate all URLs upfront before starting any downloads. | ```rust #[tauri::command] pub async fn download_batch( app: tauri::AppHandle, urls: Vec<String>, ) -> Result<Vec<String>, String> { let urls: Vec<String> = urls.iter() .map(|u| u.trim().to_string()) .filter(|u| !u.is_empty()) .collect(); // Validate all URLs first for url in &urls { if !is_valid_youtube_url(url) { return Err(format!("Invalid URL: {}", url)); } } let mut ids = Vec::with_capacity(urls.len()); for url in urls { let id = download(app.clone(), url).await?; ids.push(id); } Ok(ids) } ``` |
| 9 | **Security** | `src-tauri/src/download.rs:282-289` | **Unsanitized search query passed to yt-dlp**. The `query` parameter from the frontend is interpolated into `ytsearch10:{query}` and passed as a command argument. While Tauri's `invoke` prevents direct injection, a query containing shell metacharacters or yt-dlp-specific syntax (e.g., `--exec`) could manipulate yt-dlp's behavior if yt-dlp interprets certain patterns. | Sanitize the query by stripping leading dashes and limiting length. | ```rust #[tauri::command] pub async fn search_youtube( app: tauri::AppHandle, query: String, ) -> Result<Vec<SearchResult>, String> { let query = query.trim().to_string(); if query.is_empty() || query.len() > 200 { return Err("Invalid search query".to_string()); } // Prevent yt-dlp flag injection let query = query.trim_start_matches('-'); let search_query = format!("ytsearch10:{}", query); // ... rest unchanged } ``` |
| 10 | **Bugs & Logic** | `src-tauri/src/download.rs:186-192` | **`kill_process_tree` on Unix uses negative PID for process group kill**, but `child.id()` returns the PID, not the process group ID. The spawned yt-dlp process may not be a process group leader, so `kill(-pid, SIGTERM)` would fail or kill the wrong group. Additionally, the return value of `libc::kill` is not checked. | Use `setsid` when spawning the process to make it a group leader, or use the PID directly. Check the return value. | ```rust fn kill_process_tree(pid: u32) -> Result<(), String> { #[cfg(unix)] { let ret = unsafe { libc::kill(pid as i32, libc::SIGTERM) }; if ret != 0 { return Err(format!( "kill failed: {}", std::io::Error::last_os_error() )); } } #[cfg(windows)] { std::process::Command::new("taskkill") .args(["/F", "/T", "/PID", &pid.to_string()]) .output() .map_err(|e| e.to_string())?; } Ok(()) } ``` |
| 11 | **Bugs & Logic** | `src-tauri/src/download.rs:498` | **`child.id()` can return `None`**, and the code defaults to `0` with `unwrap_or(0)`. PID 0 on Unix refers to the kernel's idle process. If the child PID is 0 and the user cancels, `kill_process_tree(0)` would send SIGTERM to every process in the process group. | Handle the `None` case explicitly — do not register PID 0 in the children map. | ```rust let pid = match child.id() { Some(pid) => pid, None => { // Process already exited before we could get its PID // Continue without registering for cancellation 0 } }; if pid != 0 { let mut map = children.lock().await; map.insert(id_clone.clone(), pid); } ``` |
| 12 | **Security** | `src-tauri/src/download.rs:288` | **Hardcoded cookie in YouTube requests** (`Cookie:PREF=f2=8000000`). While this is a consent cookie to bypass EU consent screens, hardcoding cookies introduces a maintenance burden and could be flagged by YouTube, potentially causing request blocks. | Document why this cookie exists and consider making it configurable or removable. No immediate code change required, but add a comment. |  |
| 13 | **Performance** | `src/App.tsx:173-202` | **Download progress listener creates a new Map on every event**. With active downloads emitting frequent progress events, this triggers React re-renders for the entire download list on each event (~multiple times per second per download). | Debounce or throttle progress updates, or use a ref + periodic state sync. | ```typescript // Throttle progress updates useEffect(() => { const buffer = new Map<string, DownloadProgress>(); let rafId: number | null = null; const unlisten = onDownloadProgress((progress) => { buffer.set(progress.id, progress); if (!rafId) { rafId = requestAnimationFrame(() => { setDownloads((prev) => { const next = new Map(prev); for (const [id, p] of buffer) { next.set(id, p); } buffer.clear(); // ... pruning logic ... return next; }); rafId = null; }); } }); return () => { unlisten.then((fn) => fn()); if (rafId) cancelAnimationFrame(rafId); }; }, []); ``` |
| 14 | **Maintainability** | `src/components/SearchBar.tsx:24-27` & `src/components/UrlInput.tsx:12-14` | **Duplicated `isPlaylistUrl` function** exists in both `SearchBar.tsx` and `UrlInput.tsx` with identical implementations. | Extract to a shared utility in `src/lib/`. | ```typescript // src/lib/youtube.ts export function isPlaylistUrl(url: string): boolean { return /[?&]list=/.test(url) || /\/playlist\?/.test(url) || /\/(channel|c|@)[/\w]/.test(url); } ``` |

### Low Severity

| # | Category | File | Description | Recommendation | Code Snippet |
|---|----------|------|-------------|----------------|--------------|
| 15 | **Maintainability** | `src-tauri/src/download.rs:20` | **`MAX_CONCURRENT` is a hardcoded constant (5)**. Users on slow connections may want fewer, and power users may want more. | Consider making this configurable via `AppConfig`. | |
| 16 | **Maintainability** | `src/components/SearchBar.tsx:77-80` | **Dead code: `formatDuration` function** does nothing (returns input as-is). | Remove the function and use the value directly. | ```typescript // Replace: {result.duration && ` · ${formatDuration(result.duration)}`} // With: {result.duration && ` · ${result.duration}`} ``` |
| 17 | **Best Practices** | `src-tauri/src/download.rs:93-108` | **Unsafe FFI block for Windows ANSI code page conversion** uses `extern "system"` directly. | Consider using the `windows` or `windows-sys` crate for type-safe Windows API bindings instead of raw FFI. This reduces risk of ABI mismatches. | |
| 18 | **Best Practices** | `.github/workflows/release.yml` | **CI only builds for Windows**. The matrix only includes `windows-latest`. macOS and Linux users cannot get official builds despite the code supporting those platforms. | Add macOS and Linux to the build matrix. | ```yaml matrix: include: - platform: windows-latest args: "" - platform: macos-latest args: "--target universal-apple-darwin" - platform: ubuntu-22.04 args: "" ``` |
| 19 | **Performance** | `src-tauri/src/download.rs:430` | **`load_config` is called on every download invocation**, reading and parsing the JSON file from disk each time. In a batch of 50 downloads, this means 50 file reads. | Cache the config in the Tauri managed state and reload only when `set_config` is called. | |
| 20 | **Maintainability** | `src-tauri/src/download.rs:46-50` | **`ffmpeg_location` uses `current_exe` path** which may not match where ffmpeg is actually located (e.g., when running in dev mode, the exe is in `target/debug/`). | Consider using the same sidecar resolution strategy as `ytdlp_path`, or use Tauri's built-in sidecar resolution. | |

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 4 |
| Medium | 7 |
| Low | 6 |
| **Total** | **20** |

### Priority Remediation Order

1. **Issue #1** (CSP disabled) — Immediate fix, minimal effort
2. **Issue #2** (Binary download without verification) — High priority, moderate effort
3. **Issue #3** (Platform-specific update URL) — High priority, low effort
4. **Issue #7** (Deadlock risk) — High priority, low effort
5. **Issue #5** (Config validation) — High priority, low effort
6. **Issue #4** (Path traversal) — High priority, one-line fix
7. **Issue #11** (PID 0 kill) — Medium priority, low effort
8. **Issue #10** (Unix kill semantics) — Medium priority, low effort
9. **Issue #9** (Search query sanitization) — Medium priority, low effort
10. Remaining issues in severity order

---

*Report generated: 2026-03-18 | Review ID: CR-001*
