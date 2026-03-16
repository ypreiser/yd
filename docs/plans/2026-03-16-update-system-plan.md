# Plan: Unified Update System with Auto-Update Setting

**Date**: 2026-03-16
**Status**: Draft
**Author**: Claude + user

## Context

Current state:
- `UpdateBanner` in `App.tsx` — checks for app updates via `tauri-plugin-updater`, shows indigo banner
- `YtdlpBanner` in `App.tsx` — checks yt-dlp version against GitHub API, shows amber banner (just added, uncommitted)
- `get_ytdlp_version` command in `download.rs` — runs `yt-dlp --version` (just added, uncommitted)
- ffmpeg bundled as sidecar (`binaries/ffmpeg`) — no version check exists
- Config (`config.rs`) has: `download_dir`, `audio_format`, `theme`, `language` — no auto-update field
- Release workflow (`.github/workflows/release.yml`) — Windows-only, triggers on `v*` tags
- GH Action for auto-updating yt-dlp binary doesn't exist yet

## Goal

Unified in-app update system that checks app + yt-dlp versions, shows a single consolidated banner, and lets users toggle auto-update in settings. Plus a GH Action that auto-releases when yt-dlp publishes a new version (tested on CI before release).

## Approach

1. **Consolidate banners** — Replace two separate banners with one `UpdateBanner` that checks both app and yt-dlp, showing the most important update
2. **Auto-update config** — Add `auto_update: bool` to `AppConfig`. Default **off**. When enabled, app updates install automatically on startup (no banner, just apply). When disabled, show banner with manual "Update" button + note that auto-update can be enabled in settings
3. **Settings UI** — Add auto-update toggle to Settings page, show yt-dlp version alongside app version, add local rollback button
4. **GH Action** — Daily cron checks yt-dlp releases, downloads new binary, runs smoke test. Tests pass → auto-bump patch + tag `v1.0.X-y.YYYY.MM.DD` → triggers release. Tests fail → opens issue. Manual dispatch supports **rollback** — reverts to previous yt-dlp version and releases. Previous version tracked in `yt-dlp-version-prev.txt`.

### Versioning scheme

yt-dlp-only updates: bump patch + suffix with yt-dlp date.
- `v1.0.0` → manual feature release
- `v1.0.1-y.2026.03.13` → auto yt-dlp update
- `v1.0.2-y.2026.03.20` → another yt-dlp update
- `v1.1.0` → next manual feature release

Using `-y.` (not `+y.`) so the yt-dlp version is visible in GitHub releases and the updater. Patch bump ensures semver ordering: `1.0.1-y.2026.03.13 > 1.0.0`.

### ffmpeg check — not worth it

ffmpeg is very stable (releases ~yearly, never breaks YouTube). Its version format (`7.1.1`) isn't directly comparable to a "latest" without parsing. yt-dlp pins ffmpeg compatibility — if yt-dlp works, ffmpeg works. Adding a check adds complexity for near-zero user benefit.

### Version display

- **Banner**: show yt-dlp version when outdated (current → latest), plus note about auto-update in settings
- **Settings**: always show yt-dlp version for reference

## Alternatives Considered

| Option | Pros | Cons | Why not |
| ------ | ---- | ---- | ------- |
| Check ffmpeg too | Complete coverage | ffmpeg rarely breaks, hard to compare versions, adds noise | Low value, high complexity |
| Separate banners (current) | Simple | Two banners stacking looks bad, redundant UI | Consolidating is better UX |
| Auto-update yt-dlp binary in-place | Fastest fix for users | Security risk, antivirus flags, code signing breaks, permission issues | Too risky |
| `+y.` build metadata suffix | Semver-clean | Invisible to some tools, stripped by npm/cargo | `-y.` is more visible |

## Scope

### In Scope

- Unified `UpdateBanner` component (app + yt-dlp checks)
- `auto_update` config field (default off) + settings toggle
- yt-dlp version display in banner (when outdated) and settings (always)
- GH Action: daily yt-dlp check → smoke test → auto-release with `v1.0.X-y.YYYY.MM.DD` tag

### Out of Scope

- ffmpeg version check
- macOS/Linux release builds (currently Windows-only)
- In-place yt-dlp binary replacement

## Affected Areas

- **Files**:
  - `src/App.tsx` — consolidate banners, auto-update logic
  - `src/components/Settings.tsx` — auto-update toggle, yt-dlp version display
  - `src/lib/tauri.ts` — already has `getYtdlpVersion`
  - `src/lib/i18n.tsx` — new translations
  - `src-tauri/src/config.rs` — add `auto_update` field
  - `src-tauri/tauri.conf.json` — version bumps (automated by GH Action)
  - `.github/workflows/update-ytdlp.yml` — new workflow
  - `yt-dlp-version.txt` — new file, tracks current bundled yt-dlp version for GH Action comparison
- **Dependencies**: none new
- **Tests**: GH Action smoke test (yt-dlp --version + test download)

## Risks

- GH Action auto-release could ship broken yt-dlp: mitigated by smoke test before release
- Auto-update on startup could annoy users on metered connections: mitigated by opt-in toggle (default off)
- Bad update shipped to users: mitigated by local rollback in settings (reverts to `previous_version` saved before update) + GH Action rollback (reverts yt-dlp binary and releases)
- Semver prerelease suffix `1.0.1-y.X` technically sorts lower than `1.0.1` in strict semver: acceptable since we never have a bare `1.0.1` alongside `1.0.1-y.X` — the next feature release would be `1.1.0`

## Phases

1. **Config + Settings** — add `auto_update` field, settings toggle, yt-dlp version display
2. **Unified banner** — consolidate `UpdateBanner` + `YtdlpBanner` into single smart banner with auto-update logic
3. **GH Action** — daily yt-dlp check + auto-release workflow

## Resolved Questions

- [x] Auto-update default on or off? → **Off**
- [x] Show yt-dlp version in banner or only settings? → **Both** (banner when outdated, settings always)
- [x] Versioning scheme? → **Bump patch + `-y.YYYY.MM.DD` suffix**
