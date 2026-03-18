# Plan: Improve UI

**Date**: 2026-03-18
**Status**: Approved
**Author**: Claude + user

## Context

YD is a Tauri v2 YouTube audio downloader with React 19 + Tailwind 4. Current UI is functional but plain — basic form inputs, thin progress bars, no animations, no visual feedback on completion, and a bare empty state. The app supports Hebrew (RTL) + English, dark/light themes.

**Current components**: `App.tsx` (layout + tabs), `UrlInput.tsx`, `SearchBar.tsx`, `DownloadList.tsx`, `DownloadItem.tsx`, `PlaylistModal.tsx`, `Settings.tsx`.

## Goal

Make the app feel polished and native-quality: better visual hierarchy, micro-interactions, richer download cards, animated transitions, and a more engaging empty state — while keeping the codebase simple and lightweight (no new deps).

## Approach

Pure CSS/Tailwind improvements + minor React state additions. No new libraries. Focus areas:

1. **Download cards** — larger progress bars, thumbnail/icon, pulse animation while downloading, fade-in on appear, success checkmark animation on done
2. **Empty state** — illustration/icon + subtitle instead of plain text
3. **Tab bar** — pill-style tabs with animated indicator
4. **Input polish** — drag-drop visual hint on URL textarea, subtle focus glow
5. **Search results** — hover scale effect, loading skeletons
6. **Settings** — grouped sections with dividers, card-style grouping
7. **General** — smooth transitions for view changes, consistent spacing, better button hover/active states
8. **Resize & scroll** — set min window size in Tauri config, responsive layout that adapts from ~400px wide up, proper overflow/scroll behavior on all scrollable areas (download list, search results, settings, playlist modal), prevent content from overflowing or collapsing at small sizes

## Alternatives Considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Add Framer Motion | Rich animations | +45KB dep, complexity | Too heavy for a small app |
| Add a component library (Radix, shadcn) | Polished out-of-box | Dep overhead, style conflicts | Current Tailwind approach is fine |
| CSS-only improvements | Zero deps, fast | Limited animation control | **Chosen approach** — good enough |

## Scope

### In Scope

- Visual polish for all existing components
- CSS animations (fade-in, pulse, slide, checkmark)
- Better empty state
- Improved progress bars and download cards
- Search result loading skeletons
- Settings visual grouping
- Consistent hover/active/focus states

### Out of Scope

- New features (no new functionality)
- Backend/Rust changes
- New npm dependencies
- Structural refactoring of component hierarchy
- Custom window titlebar

## Affected Areas

- **Files**: `App.css`, `App.tsx`, `DownloadItem.tsx`, `DownloadList.tsx`, `SearchBar.tsx`, `UrlInput.tsx`, `Settings.tsx`, `PlaylistModal.tsx`, `src-tauri/tauri.conf.json`
- **Dependencies**: none (zero new packages)
- **Tests**: visual only — no new test coverage needed
- **Docs**: none

## Risks

- RTL compatibility: all CSS changes must work in both LTR and RTL — use logical properties (`ms-`, `me-`, `ps-`, `pe-`) where applicable
- Dark/light theme: every color change needs both variants
- Performance: CSS animations should use `transform`/`opacity` only (GPU-composited)
- Small window sizes: layout must not break at minWidth (400px), all content must remain accessible via scroll

## Phases

1. **Foundation** — CSS keyframes, utility classes in `App.css`, Tauri window config (minWidth/minHeight)
2. **Layout & scroll** — fix resize behavior, proper flex/overflow on all scrollable containers, responsive breakpoints
3. **Download cards** — richer `DownloadItem` with better progress bar, status animations
4. **Empty state & input** — engaging empty state, URL input drag-drop hint
5. **Search & tabs** — skeleton loading, pill tabs, result hover effects
6. **Settings & modal** — grouped settings, modal backdrop blur, settings scroll fix

## Open Questions

- Specific color palette preferences beyond current indigo?
- Want a download completion sound/system notification?
- Any specific icon/illustration for empty state, or keep it text-based with a simple SVG?
