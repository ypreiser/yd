# YD — Code Review Report

**Project:** YD (YouTube Song Downloader)
**Date:** 2026-03-26
**Scope:** Rust backend (`src-tauri/`) + React/TypeScript frontend (`src/`)
**Review ID:** CR-003

---

## Regression & Fix Verification

| # | Issue | Previous Status | CR-003 Status |
|---|-------|-----------------|---------------|
| #1 | CSP disabled | Deferred | **Resolved** — CSP set; see new finding #24 for gaps |
| #2 | Unverified binary download | Fixed (v1.1.1) | Confirmed fixed |
| #3 | Unverified binary exec | Fixed (v1.1.1) | Confirmed fixed |
| #4 | Path traversal via title | Deferred | Still open |
| #5 | Config validation | Fixed | Confirmed fixed |
| #6 | Version comparison | Fixed | Confirmed fixed |
| #7 | Deadlock in cancel_download | Fixed | Confirmed fixed |
| #9 | Search query sanitization | Fixed | Confirmed fixed |
| #10 | Unix kill semantics | Fixed | Confirmed fixed |
| #11 | PID 0 kill risk | Fixed | Confirmed fixed |
| #12 | Hardcoded cookie | Open | Still open |
| #13 | Progress re-render perf | Fixed | Confirmed fixed |
| #14 | Duplicated isPlaylistUrl | Fixed | Confirmed fixed |
| #15 | Hardcoded MAX_CONCURRENT | Open | Still open |
| #16 | Dead formatDuration | Fixed | Confirmed fixed |
| #17 | Raw FFI | Open | Still open |
| #18 | CI matrix Windows-only | Open | Still open |
| #19 | load_config on every download | Open | Still open |
| #20 | ffmpeg_location path | Open | Still open |
| #21 | Platform URL hardcoded | Open | Still open |
| #22 | Search result race condition | Fixed | Confirmed fixed |
| #23 | PID map leak on cancel | Fixed | Confirmed fixed |

---

## New Findings (CR-003)

| # | Severity | Category | Location | Description |
|---|----------|----------|----------|-------------|
| #24 | High | Security | `tauri.conf.json:24` | CSP missing `connect-src` and `script-src` directives |
| #25 | High | Security | `release.yml:39-42` | CI downloads yt-dlp before checksum file; TOCTOU window |
| #26 | Medium | Security | `release.yml:51-53` | ffmpeg downloaded from gyan.dev with no checksum verification |
| #27 | Medium | Bugs & Logic | `src-tauri/src/download.rs:387-389` | taskkill error causes cancel to fail; process may keep running |
| #28 | Medium | Accessibility | `src/components/PlaylistModal.tsx:52` | Dialog on backdrop div, not focusable; focus not trapped inside modal |
| #29 | Low | Accessibility | `src/App.tsx:298-317` | Tab mode switcher buttons lack aria-pressed or role="tab" |
| #30 | Low | Security | `src-tauri/capabilities/default.json:11` | `$DOCUMENT/**`, `$AUDIO/**`, `$VIDEO/**`, `$DESKTOP/**` open-path permissions broader than needed |
| #31 | Low | Maintainability | `src/App.css:73-79` | Global `*:focus-visible` overrides may conflict with Tailwind ring styles |

---

## Detailed Findings

### #24 — CSP Missing connect-src and script-src

- **Severity**: High
- **Category**: Security
- **Location**: `src-tauri/tauri.conf.json:24`
- **Description**: The newly added CSP is:
  ```
  default-src 'self'; img-src 'self' https://i.ytimg.com https://*.googleusercontent.com https://*.ggpht.com; style-src 'self' 'unsafe-inline'
  ```
  `default-src 'self'` acts as fallback for `connect-src` and `script-src`, which is correct for blocking external script loads. However, the Tauri IPC mechanism in v2 uses `http://ipc.localhost` for `connect-src`. Without an explicit `connect-src http://ipc.localhost`, IPC calls from the webview may be blocked by some Tauri/WebView2 configurations. Additionally, the GitHub API calls made by `check_ytdlp_update` in Rust bypass the webview CSP entirely (they are native HTTP, not fetch), so no `connect-src` whitelist for `api.github.com` is needed — but the omission of `connect-src` should be explicit rather than implicit.

  The previous open issue noted that `ipc: http://ipc.localhost` must appear in `connect-src` for Tauri v2. This has not been addressed.

- **Recommendation**: Add explicit directives:
```json
"csp": "default-src 'self'; script-src 'self'; connect-src ipc: http://ipc.localhost; img-src 'self' https://i.ytimg.com https://*.googleusercontent.com https://*.ggpht.com; style-src 'self' 'unsafe-inline'"
```

---

### #25 — CI Checksum TOCTOU: Binary Downloaded Before Checksum File

- **Severity**: High
- **Category**: Security
- **Location**: `.github/workflows/release.yml:39-42`
- **Description**: The workflow downloads `yt-dlp.exe` first, then downloads `SHA2-256SUMS`, then verifies. Both requests hit `releases/latest`, which is a redirect resolved independently. If the latest release changes between the two `curl` calls (e.g. a new release is published during the build), the binary and the checksum file will be from different releases and the checksum will not match — causing a spurious build failure, not a security breach. The more serious concern is that both downloads resolve `/releases/latest` at the same CDN level without pinning, so a CDN cache inconsistency could serve different versions. To harden: pin to a specific version tag rather than `latest`, or download the checksum file first.

- **Recommendation**:
```yaml
# Download checksum file FIRST, extract expected hash, then download binary
curl -L -o yt-dlp-checksums.txt \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS
expected=$(grep 'yt-dlp.exe$' yt-dlp-checksums.txt | awk '{print $1}')
curl -L -o src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
actual=$(sha256sum src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe | awk '{print $1}')
if [ "$expected" != "$actual" ]; then
  echo "::error::yt-dlp checksum mismatch"
  exit 1
fi
```

---

### #26 — ffmpeg Downloaded from gyan.dev Without Checksum

- **Severity**: Medium
- **Category**: Security
- **Location**: `.github/workflows/release.yml:51-53`
- **Description**: ffmpeg is downloaded from `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip` with no integrity check. This is a third-party personal hosting site, not an official ffmpeg release channel. A compromise of gyan.dev or its CDN would silently inject a malicious ffmpeg binary into every app release. Unlike yt-dlp, gyan.dev does not publish signed checksums, but it does publish SHA256 hashes on the same page.
- **Recommendation**: Pin to a specific known-good version URL and verify against a hardcoded expected SHA256 in the workflow. Alternatively, use the official `https://github.com/BtbN/FFmpeg-Builds` releases, which are more auditable.

---

### #27 — taskkill Error Propagates as cancel_download Failure

- **Severity**: Medium
- **Category**: Bugs & Logic
- **Location**: `src-tauri/src/download.rs:387-389`
- **Description**: The new error check on `taskkill` output returns `Err` when taskkill fails. `cancel_download` calls `kill_process_tree(pid)?`, so a taskkill failure (e.g. process already exited between PID lookup and kill) propagates as a command error to the frontend. The cancelled entry is added to the `cancelled` set before the kill, so the UI will not mark the item as cancelled — it will show an error instead. The process also keeps running if it hasn't actually exited.

  More critically: `taskkill` exits with a non-zero code and writes to stderr when the target process does not exist (already exited). This is a normal race condition — the process finished between the `children` map lookup and the kill call. The previous code with `.spawn()` silently ignored this, which was arguably the correct behavior for a cancel operation.

- **Recommendation**: Distinguish "process not found" from genuine taskkill failure:
```rust
if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    // taskkill exits 128 with "not found" when process already exited — treat as success
    if !stderr.contains("not found") && !stderr.contains("no running instance") {
        return Err(format!("taskkill failed: {}", stderr));
    }
}
```
Or more robustly, always return `Ok(())` from `kill_process_tree` on Windows (the old behavior) since a cancel on an already-finished process is not an error condition from the user's perspective.

---

### #28 — Dialog Not Focus-Trapped; Keyboard Navigation Escapes Modal

- **Severity**: Medium
- **Category**: Accessibility
- **Location**: `src/components/PlaylistModal.tsx:52-63`
- **Description**: The modal backdrop is a `<div>` with `role="dialog"`. The Escape key handler is attached to the backdrop div, but `div` elements are not natively focusable. Keyboard events will only fire on the backdrop if it or a child has focus. The `onKeyDown` handler works when a child button/input is focused, but if focus moves outside the modal (Tab past the last item), keyboard users can interact with content behind the modal.

  A proper modal must:
  1. Trap focus within the modal bounds (intercept Tab/Shift+Tab at boundaries).
  2. Move focus into the modal on open.
  3. Restore focus to the trigger element on close.

  None of these are implemented.

- **Recommendation**: Add `tabIndex={-1}` to the inner modal container and focus it on mount; add a focus-trap on Tab key:
```tsx
const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  modalRef.current?.focus();
}, []);

function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key === "Escape") { onClose(); return; }
  if (e.key === "Tab") {
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }
}

// On inner div:
<div ref={modalRef} tabIndex={-1} onKeyDown={handleKeyDown} ...>
```

---

### #29 — URL/Search Tab Buttons Missing ARIA Role

- **Severity**: Low
- **Category**: Accessibility
- **Location**: `src/App.tsx:298-317`
- **Description**: The URL/Search mode switcher renders as two plain `<button>` elements with no semantic relationship. Screen readers announce them as independent buttons with no indication that they form a tab group. `aria-pressed` or a `role="tablist"` + `role="tab"` pattern should be applied.
- **Recommendation**:
```tsx
<div role="tablist" className="flex gap-1 p-1 ...">
  <button
    role="tab"
    aria-selected={inputMode === "url"}
    onClick={() => setInputMode("url")}
    ...
  >URL</button>
  <button
    role="tab"
    aria-selected={inputMode === "search"}
    onClick={() => setInputMode("search")}
    ...
  >{t.search}</button>
</div>
```

---

### #30 — open-path Permissions Broader Than Needed

- **Severity**: Low
- **Category**: Security
- **Location**: `src-tauri/capabilities/default.json:11`
- **Description**: `opener:allow-open-path` still includes `$DOCUMENT/**`, `$AUDIO/**`, `$VIDEO/**`, `$DESKTOP/**`. The app's primary function is opening a file in the download folder via "open folder" button. The `$HOME/**` permission was correctly removed, but the remaining wildcard paths allow the Tauri opener to open any file in Documents, Audio, Video, and Desktop directories — which is broader than the use case requires.
- **Recommendation**: Restrict to `$DOWNLOAD` and `$DOWNLOAD/**` only. If users configure a custom download directory outside these locations, the opener will need adjusting, but that is preferable to over-broad permissions.

---

### #31 — Global focus-visible Rule May Conflict with Tailwind

- **Severity**: Low
- **Category**: Maintainability
- **Location**: `src/App.css:73-79`
- **Description**: The new `*:focus-visible` rule in `App.css` applies a 2px indigo outline globally. Tailwind's `focus:ring-2 focus:ring-indigo-500/30` classes on inputs produce a different style. Both will apply simultaneously on focused inputs, resulting in a double visual indicator (CSS outline + Tailwind ring). The `focus:outline-none` class on the textarea in `UrlInput.tsx:115` suppresses the native outline but the `*:focus-visible` rule has specificity `0,0,1` while `outline-none` from Tailwind sets `outline: 2px solid transparent` — the cascade order determines which wins, and it varies by build.
- **Recommendation**: Either add `focus:outline-none` to the global rule's exclusion list, or replace `focus:outline-none` in Tailwind classes with `focus-visible:outline-none` consistently. Verify visually that inputs don't show double focus rings.

---

## Summary

| Severity | Previous (CR-002) | New (CR-003) | Delta |
|----------|-------------------|--------------|-------|
| Critical | 3 | 0 | −3 resolved |
| High | 2 | 2 | #1 partially resolved → #24; +#25 |
| Medium | 10 | 4 | many resolved; +#26, #27, #28 |
| Low | 8 | 3 | +#29, #30, #31 |

### Open Issues After CR-003

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| #4 | Path traversal via video title on Unix | Medium | `--restrict-filenames` breaks non-ASCII dirs |
| #12 | Hardcoded YouTube consent cookie | Medium | Needs documentation |
| #15 | Hardcoded MAX_CONCURRENT | Low | — |
| #17 | Raw FFI for MultiByteToWideChar | Low | Consider `windows-sys` crate |
| #18 | CI matrix Windows-only | Low | — |
| #19 | load_config on every download | Low | — |
| #20 | ffmpeg_location dev path issue | Low | — |
| #21 | Platform URL hardcoded (update_ytdlp) | Medium | Only matters if macOS/Linux support added |
| #24 | CSP missing connect-src/ipc | High | Blocks IPC in some WebView2 configs |
| #25 | CI checksum TOCTOU | High | — |
| #26 | ffmpeg no checksum in CI | Medium | — |
| #27 | taskkill error breaks cancel | Medium | — |
| #28 | Modal focus trap missing | Medium | — |
| #29 | Tab buttons no ARIA role | Low | — |
| #30 | open-path over-broad permissions | Low | — |
| #31 | focus-visible double ring | Low | — |

---

_Report generated: 2026-03-26 | Review ID: CR-003_
