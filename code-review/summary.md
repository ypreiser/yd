# YD - YouTube Song Downloader: Code Review Report

**Date:** 2026-03-18
**Reviewer:** Senior Software Architect & Security Lead
**Scope:** Full codebase review (Frontend: React/TypeScript, Backend: Rust/Tauri v2)
**Review ID:** CR-001 (Initial Review)

---

## Regression & Fix Verification

> **First review** — no prior report exists. This section will be populated in subsequent reviews to track resolved issues.

---

## Executive Summary

YD is a well-structured Tauri v2 desktop app with clean separation between frontend and backend. The codebase is compact (~1,800 lines total) and generally follows good practices. However, several security, correctness, and robustness issues were identified that should be addressed before production release.

**Issue Breakdown:**
| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 4     |
| Medium   | 6     |
| Low      | 5     |
| **Total** | **17** |

---

## Findings

### Critical Severity

#### Issue #1 — CSP Disabled (Content Security Policy set to `null`)

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Category** | Security |
| **File** | `src-tauri/tauri.conf.json:22` |
| **Description** | The `"csp": null` setting disables Content Security Policy entirely. In a Tauri app that renders remote thumbnails from `i.ytimg.com` and `youtube.com`, this allows unrestricted script execution. If any user-supplied content (e.g., video title from yt-dlp) is rendered unsanitized, an attacker could inject scripts via crafted video metadata. While React's JSX escapes strings by default, `null` CSP removes the defense-in-depth layer entirely. |
| **Recommendation** | Define a strict CSP that only allows necessary sources. |

**Refactored code (`src-tauri/tauri.conf.json`):**
```json
"security": {
  "csp": "default-src 'self'; img-src 'self' https://i.ytimg.com https://*.ytimg.com; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost https://github.com"
}
```

---

#### Issue #2 — Path Traversal via `download_dir` in yt-dlp Output Template

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Category** | Security |
| **File** | `src-tauri/src/download.rs:397` |
| **Description** | The download output path is constructed as `format!("{}/%(title)s.%(ext)s", config.download_dir)`. The `download_dir` is user-configurable via the settings UI (text input field at `Settings.tsx:65`), and is persisted without validation. A malicious or accidental path like `../../etc` or a path with shell metacharacters could cause files to be written to unexpected locations. Additionally, the `%(title)s` portion is controlled by YouTube metadata — a crafted video title containing `../` could write outside the intended directory. |
| **Recommendation** | Validate `download_dir` is an absolute path and exists. Use yt-dlp's `--restrict-filenames` flag to sanitize the title portion. Validate the config on save. |

**Refactored code (`src-tauri/src/download.rs`):**
```rust
// Add --restrict-filenames to sanitize video titles in filenames
.args([
    "--extract-audio",
    "--audio-format",
    &config.audio_format,
    "--newline",
    "--progress",
    "--ffmpeg-location",
    &ffmpeg_path,
    "--restrict-filenames",  // Sanitize title to safe ASCII characters
    "--print", "before_dl:YTDL_TITLE:%(title)s",
    "-o",
    &format!("{}/%(title)s.%(ext)s", config.download_dir),
    &url_clone,
])
```

**Refactored code (`src-tauri/src/config.rs`) — add validation on save:**
```rust
#[tauri::command]
pub fn set_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    // Validate download_dir is an absolute path
    let path = std::path::Path::new(&config.download_dir);
    if !path.is_absolute() {
        return Err("Download directory must be an absolute path".to_string());
    }
    // Validate audio_format
    const ALLOWED: &[&str] = &["m4a", "mp3", "opus", "flac"];
    if !ALLOWED.contains(&config.audio_format.as_str()) {
        return Err(format!("Invalid audio format: {}", config.audio_format));
    }
    save_config(&app, &config)
}
```

---

### High Severity

#### Issue #3 — Search Query Injection via yt-dlp Arguments

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Category** | Security |
| **File** | `src-tauri/src/download.rs:46` |
| **Description** | The `search_youtube` function passes user input directly into yt-dlp: `format!("ytsearch10:{}", query)`. While Tauri's sidecar mechanism uses `Command` (not shell invocation), the query is interpolated into a yt-dlp search string. A user could craft input like `--exec "malicious command"` which yt-dlp might interpret if the string starts with `--`. The sidecar arg passing mitigates shell injection, but yt-dlp's own argument parsing could still be exploited. |
| **Recommendation** | Sanitize the query: reject or strip inputs starting with `-`, and enforce a reasonable length limit. |

**Refactored code:**
```rust
#[tauri::command]
pub async fn search_youtube(
    app: tauri::AppHandle,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let query = query.trim().to_string();
    if query.is_empty() || query.len() > 200 {
        return Err("Invalid search query".to_string());
    }
    // Prevent argument injection: yt-dlp could interpret --flag-like inputs
    if query.starts_with('-') {
        return Err("Invalid search query".to_string());
    }
    // ... rest of function
```

---

#### Issue #4 — Semaphore Permit Leak on Spawn Failure

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/download.rs:366-522` |
| **Description** | The semaphore `_permit` is acquired at line 367 and held until the spawned task completes. If `sidecar.spawn()` fails (line 401), the error path emits an error event but the `_permit` is properly dropped. However, if the `rx.recv()` loop panics for any reason, the permit is leaked because `_permit` would not be dropped. More importantly, if a download is cancelled while waiting on the semaphore (queued status), there is no mechanism to cancel the waiting — the semaphore slot will remain occupied until the cancelled task eventually runs and finishes. |
| **Recommendation** | Use `tokio::select!` to race the semaphore acquisition against a cancellation signal (e.g., `tokio::sync::watch` or `CancellationToken`). |

**Refactored code (conceptual — uses cancellation token):**
```rust
use tokio_util::sync::CancellationToken;

// In DownloadState, add:
// pub cancel_tokens: Arc<Mutex<HashMap<String, CancellationToken>>>

// In the spawned task:
let token = CancellationToken::new();
// Store token before spawning:
// state.cancel_tokens.lock().await.insert(id.clone(), token.clone());

tokio::select! {
    _permit = semaphore.acquire() => {
        // proceed with download
    }
    _ = token.cancelled() => {
        // emit cancelled status, return early
    }
}
```

---

#### Issue #5 — `download_batch` Fails Fast, Abandoning Remaining URLs

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/download.rs:528-542` |
| **Description** | `download_batch` iterates over URLs and calls `download()` sequentially with `?` error propagation. If any single URL fails validation (e.g., not a valid YouTube URL), the entire batch is aborted and remaining URLs are never processed. The user sees an error and loses the remaining downloads. |
| **Recommendation** | Collect errors per-URL and continue processing. Return all IDs for successfully started downloads. |

**Refactored code:**
```rust
#[tauri::command]
pub async fn download_batch(
    app: tauri::AppHandle,
    urls: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut ids = Vec::new();
    for url in urls {
        let url = url.trim().to_string();
        if url.is_empty() {
            continue;
        }
        match download(app.clone(), url).await {
            Ok(id) => ids.push(id),
            Err(_) => continue, // Skip invalid URLs, don't abort entire batch
        }
    }
    Ok(ids)
}
```

---

#### Issue #6 — Integer Overflow in `kill_process_tree` (Unix)

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/download.rs:195` |
| **Description** | `pid as i32` performs a truncating cast. On 64-bit systems, PIDs are `u32`. If the PID exceeds `i32::MAX` (2,147,483,647), the negation `-(pid as i32)` will produce an incorrect value. Additionally, the return value of `libc::kill()` is not checked — a failed kill is silently ignored. |
| **Recommendation** | Check that the PID fits in `i32` before casting. Check the return value of `kill()`. |

**Refactored code:**
```rust
#[cfg(unix)]
{
    let pid_i32: i32 = pid.try_into().map_err(|_| format!("PID {} too large", pid))?;
    let ret = unsafe { libc::kill(-pid_i32, libc::SIGTERM) };
    if ret != 0 {
        return Err(format!(
            "Failed to kill process group {}: {}",
            pid,
            std::io::Error::last_os_error()
        ));
    }
}
```

---

### Medium Severity

#### Issue #7 — No Input Length Limit on URL Textarea

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Security / Performance |
| **File** | `src/components/UrlInput.tsx:26` |
| **Description** | The `extractUrls` function runs a complex regex against arbitrary-length input without any limit. A user could paste megabytes of text, causing the regex engine to consume excessive CPU (ReDoS risk). The regex itself has nested optional groups that could contribute to catastrophic backtracking. |
| **Recommendation** | Add a `maxLength` to the textarea and/or limit the input length before regex processing. |

**Refactored code:**
```tsx
<textarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder={t.urlPlaceholder}
  rows={3}
  maxLength={50000}  // ~50KB limit prevents regex abuse
  disabled={disabled || playlistLoading}
  // ... rest of props
/>
```

---

#### Issue #8 — `extractUrls` Doesn't Deduplicate Against Original URLs

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Bugs & Logic |
| **File** | `src/components/UrlInput.tsx:25-36` |
| **Description** | The deduplication strips `&si=` / `?si=` tracking params from the matched URL before checking the `seen` set, but the _original_ (unstripped) URL is added to the return array, not the cleaned version. This means if a user pastes the same URL with different `si` values, the set correctly deduplicates, but the returned URLs still contain tracking parameters. Additionally, two URLs that differ only in their `si=` suffix will be deduplicated, but the first one (with its `si` param) is kept. |
| **Recommendation** | Return the cleaned URL instead of the original match. |

**Refactored code:**
```typescript
function extractUrls(input: string): string[] {
  const ytRegex = /https?:\/\/(?:www\.)?(?:...)/gi;
  const matches = input.match(ytRegex);
  if (!matches) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of matches) {
    const clean = url.split("&si=")[0].split("?si=")[0];
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(clean); // Return the cleaned URL
    }
  }
  return result;
}
```

---

#### Issue #9 — Config File Race Condition (Concurrent Read/Write)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/config.rs:40-54` |
| **Description** | `load_config` and `save_config` use `fs::read_to_string` and `fs::write` without any locking. If two downloads start simultaneously and both call `load_config`, and the user saves settings at the same time, the config file could be partially written/read, leading to corrupted JSON that falls back to defaults (silently losing settings). |
| **Recommendation** | Use a `Mutex<AppConfig>` in the Tauri managed state for in-memory config, or use file locking. |

**Refactored code (conceptual):**
```rust
// In lib.rs managed state, add:
// .manage(Arc::new(Mutex::new(load_config_from_disk())))
// Then load_config reads from the mutex, save_config writes to both mutex and disk.
```

---

#### Issue #10 — Error Messages Leak Internal Details to Frontend

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Security |
| **File** | `src-tauri/src/download.rs:53`, `config.rs:52-53` |
| **Description** | Raw stderr output from yt-dlp and filesystem error messages (`e.to_string()`) are returned directly to the frontend. These could contain local file paths, system usernames, or internal state information. While this is a desktop app (lower risk than web), it still violates the principle of least information exposure. |
| **Recommendation** | Log detailed errors server-side and return user-friendly messages to the frontend. |

---

#### Issue #11 — `expect()` Panics in Production Code

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/download.rs:39,177,178,221,245,385` |
| **Description** | Multiple `.expect()` calls are used throughout the download module: `sidecar("yt-dlp").expect(...)`, `current_exe().expect(...)`, `parent().expect(...)`. If any of these fail (e.g., sidecar binary missing, exe path unavailable), the entire application will panic and crash instead of showing a graceful error. |
| **Recommendation** | Replace `expect()` with proper `Result` error propagation using `?` or `map_err`. |

**Refactored code example:**
```rust
let sidecar = app
    .shell()
    .sidecar("yt-dlp")
    .map_err(|_| "yt-dlp binary not found. Please reinstall the app.".to_string())?
    .env("PYTHONUTF8", "1")
    // ...
```

---

#### Issue #12 — `taskkill` on Windows: Spawned But Not Awaited

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Bugs & Logic |
| **File** | `src-tauri/src/download.rs:186-189` |
| **Description** | On Windows, `kill_process_tree` uses `.spawn()` which starts `taskkill` asynchronously and returns immediately. The success/failure of the kill is never checked. If `taskkill` fails (e.g., access denied), the download will appear cancelled but the yt-dlp process continues running in the background consuming resources. |
| **Recommendation** | Use `.output()` or `.status()` instead of `.spawn()` to wait for completion and check the result. |

**Refactored code:**
```rust
#[cfg(windows)]
{
    let output = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to run taskkill: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "taskkill failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
}
```

---

### Low Severity

#### Issue #13 — Dead Code: `formatDuration` Function

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Category** | Maintainability |
| **File** | `src/components/SearchBar.tsx:43-46` |
| **Description** | The `formatDuration` function is a no-op identity function — it returns the input string unchanged. It was likely a placeholder for future formatting logic that was never implemented. |
| **Recommendation** | Remove the function and use the duration string directly, or implement actual formatting. |

---

#### Issue #14 — `onDownloadProgress` Cleanup Uses Async Pattern Unnecessarily

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Category** | Maintainability |
| **File** | `src/App.tsx:189-191` |
| **Description** | The cleanup function `unlisten.then((fn) => fn())` stores a `Promise<UnlistenFn>` and chains `.then()` in the effect cleanup. If the component unmounts before the listener is registered, the cleanup runs after registration — but there is a brief window where events could be processed on an unmounted component, though React 18's batching mitigates this. |
| **Recommendation** | Use an async pattern with a cleanup flag for correctness. |

**Refactored code:**
```tsx
useEffect(() => {
  let unlistenFn: (() => void) | null = null;
  let cancelled = false;

  onDownloadProgress((progress) => {
    if (!cancelled) {
      setDownloads((prev) => {
        // ... same logic
      });
    }
  }).then((fn) => {
    if (cancelled) {
      fn(); // Already unmounted, unlisten immediately
    } else {
      unlistenFn = fn;
    }
  });

  return () => {
    cancelled = true;
    unlistenFn?.();
  };
}, []);
```

---

#### Issue #15 — Rollback Implementation is Incorrect

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Category** | Bugs & Logic |
| **File** | `src/components/Settings.tsx:172-184` |
| **Description** | The rollback button calls `check()` from the updater plugin, which checks for the *latest* version — it does not download a specific older version. If the user is already on the latest version, `check()` returns `null` and nothing happens. The rollback feature is effectively non-functional for its stated purpose (reverting to `previous_version`). |
| **Recommendation** | Either implement a proper rollback mechanism that downloads a specific version, or remove the feature to avoid user confusion. Document the limitation if kept. |

---

#### Issue #16 — TypeScript Type Coercion for Language/Theme

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Category** | Maintainability |
| **File** | `src/App.tsx:148-149` |
| **Description** | `cfg.language` and `cfg.theme` are typed as `string` from the Rust config but are used as union types (`"en" | "he"` and `"dark" | "light"`). The fallback `|| "he"` / `|| "dark"` only handles falsy values, not invalid strings. If the config file is manually edited to contain `"language": "fr"`, the app will use `"fr"` which isn't a valid Language type, potentially causing runtime errors. |
| **Recommendation** | Add validation for the language and theme values. |

**Refactored code:**
```tsx
const validLangs: Language[] = ["en", "he"];
const validThemes = ["dark", "light"] as const;

getConfig().then((cfg: AppConfig) => {
  setLanguage(validLangs.includes(cfg.language as Language) ? cfg.language as Language : "he");
  setTheme(validThemes.includes(cfg.theme as any) ? cfg.theme : "dark");
});
```

---

#### Issue #17 — `cancel_download` Holds Lock While Killing Process

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Category** | Performance |
| **File** | `src-tauri/src/download.rs:545-556` |
| **Description** | In `cancel_download`, the `children` mutex lock is acquired at line 548 and held across the `cancelled` lock acquisition (line 550) and `kill_process_tree` call (line 551). If `kill_process_tree` takes time (especially the Windows `taskkill` subprocess), all other operations that need the `children` map are blocked. |
| **Recommendation** | Copy the PID out of the lock, drop the lock, then kill the process. |

**Refactored code:**
```rust
#[tauri::command]
pub async fn cancel_download(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<DownloadState>();
    let pid = {
        let map = state.children.lock().await;
        match map.get(&id) {
            Some(&pid) => pid,
            None => return Err("download not found or already finished".to_string()),
        }
    };
    state.cancelled.lock().await.insert(id);
    kill_process_tree(pid)
}
```

---

## Summary Table

| # | Severity | Category | File | Short Description |
|---|----------|----------|------|-------------------|
| 1 | Critical | Security | `tauri.conf.json` | CSP disabled (`null`) |
| 2 | Critical | Security | `download.rs:397` | Path traversal via download_dir / video title |
| 3 | High | Security | `download.rs:46` | Search query injection into yt-dlp |
| 4 | High | Bugs & Logic | `download.rs:366` | Semaphore permit leak / no queued cancellation |
| 5 | High | Bugs & Logic | `download.rs:528` | download_batch fails fast on first error |
| 6 | High | Bugs & Logic | `download.rs:195` | Integer overflow in kill_process_tree (Unix) |
| 7 | Medium | Security/Perf | `UrlInput.tsx:26` | No input length limit on URL textarea |
| 8 | Medium | Bugs & Logic | `UrlInput.tsx:25` | extractUrls returns un-cleaned URLs |
| 9 | Medium | Bugs & Logic | `config.rs:40` | Config file race condition |
| 10 | Medium | Security | `download.rs:53` | Internal error details leaked to frontend |
| 11 | Medium | Bugs & Logic | `download.rs:39+` | `expect()` panics crash the app |
| 12 | Medium | Bugs & Logic | `download.rs:186` | taskkill spawned but not awaited (Windows) |
| 13 | Low | Maintainability | `SearchBar.tsx:43` | Dead code: no-op formatDuration |
| 14 | Low | Maintainability | `App.tsx:189` | Async unlisten cleanup race |
| 15 | Low | Bugs & Logic | `Settings.tsx:172` | Rollback feature is non-functional |
| 16 | Low | Maintainability | `App.tsx:148` | No validation for language/theme config values |
| 17 | Low | Performance | `download.rs:545` | Mutex held during process kill |

---

## Positive Observations

- **URL validation whitelist**: `is_valid_youtube_url()` uses an allowlist approach — good security practice
- **Concurrency control**: The semaphore pattern for limiting concurrent downloads is well-implemented
- **Audio format allowlist**: `ALLOWED_AUDIO_FORMATS` prevents arbitrary format injection
- **React JSX auto-escaping**: Video titles rendered via JSX are safely escaped by default
- **i18n architecture**: Clean context-based i18n with type-safe translations
- **Sidecar isolation**: Using Tauri's sidecar mechanism (not raw shell execution) provides process isolation
- **Capability permissions**: The shell permissions correctly scope sidecar execution to only `yt-dlp`
