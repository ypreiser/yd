# TODO: Improve UI

**Plan**: [link to plan doc](./2026-03-18-improve-ui-plan.md)
**Date**: 2026-03-18
**Status**: Draft

## Phase 1: Foundation

**Acceptance**: CSS keyframes defined, Tauri min window size set, app still renders correctly

- [ ] `src-tauri/tauri.conf.json` — Add `minWidth: 400`, `minHeight: 500` to window config
- [ ] `src/App.css` — Add keyframes: `fadeIn`, `slideUp`, `pulse-glow`, `checkmark-pop`
- [ ] `src/App.css` — Add utility classes: `.animate-fade-in`, `.animate-slide-up`, `.animate-pulse-glow`, `.animate-check`
- [ ] `src/App.css` — Add smooth scrollbar transition, improve scrollbar styling for both themes
- [ ] Verify: app launches, no visual regressions

## Phase 2: Layout & Scroll

**Acceptance**: Window resizes gracefully from 400px to any size, all lists scroll properly, no overflow/clipping

- [ ] `src/App.tsx` — Ensure main container uses `min-h-0` on flex children to allow proper shrinking
- [ ] `src/App.tsx` — Add `overflow-hidden` to outer content area, `min-w-0` where needed for truncation
- [ ] `src/components/DownloadList.tsx` — Verify `overflow-y-auto flex-1 min-h-0` for proper scroll
- [ ] `src/components/SearchBar.tsx` — Ensure results list has `min-h-0` + `overflow-y-auto` within flex container
- [ ] `src/components/Settings.tsx` — Wrap in proper scrollable container that respects flex parent
- [ ] `src/components/PlaylistModal.tsx` — Ensure modal content scrolls properly at small heights
- [ ] Verify: resize window to 400×500, all views scroll, nothing clips or overflows

## Phase 3: Download Cards

**Acceptance**: Download items have thicker progress bar, fade-in animation, pulse while downloading, checkmark on done

- [ ] `src/components/DownloadItem.tsx` — Add `animate-fade-in` class to card wrapper
- [ ] `src/components/DownloadItem.tsx` — Increase progress bar height from `h-1.5` to `h-2` with rounded ends
- [ ] `src/components/DownloadItem.tsx` — Add animated gradient/shimmer on progress bar while downloading
- [ ] `src/components/DownloadItem.tsx` — Add subtle `animate-pulse-glow` border effect while downloading
- [ ] `src/components/DownloadItem.tsx` — Add green checkmark icon with `animate-check` when status is `done`
- [ ] `src/components/DownloadItem.tsx` — Add error icon (red ✕) when status is `error`
- [ ] Verify: start a download, watch card appear with animation, progress bar animates, done shows checkmark

## Phase 4: Empty State & Input

**Acceptance**: Empty state shows icon + text, URL textarea has drag hint and better focus styling

- [ ] `src/components/DownloadList.tsx` — Replace plain text with SVG download icon + primary text + subtitle
- [ ] `src/components/UrlInput.tsx` — Add drag-over visual hint (dashed border, color change) via `onDragOver`/`onDragLeave` state
- [ ] `src/components/UrlInput.tsx` — Improve focus ring: larger glow, smooth transition
- [ ] `src/components/SearchBar.tsx` — Match input focus styling with UrlInput
- [ ] Verify: empty state looks engaging, drag over textarea shows visual hint

## Phase 5: Search & Tabs

**Acceptance**: Tabs have pill/segment style, search shows skeletons while loading, results have hover lift

- [ ] `src/App.tsx` — Restyle tab bar: pill/segment control with background highlight instead of underline
- [ ] `src/components/SearchBar.tsx` — Add skeleton loading cards (3-4 placeholder cards) while `loading` is true
- [ ] `src/components/SearchBar.tsx` — Add hover scale/lift effect on result cards (`hover:scale-[1.01] hover:shadow-md`)
- [ ] `src/App.css` — Add `@keyframes skeleton-shimmer` for loading placeholders
- [ ] Verify: switch tabs smoothly, search shows skeletons, results have hover effect

## Phase 6: Settings & Modal Polish

**Acceptance**: Settings has grouped card sections, modal has backdrop blur, buttons have better active states

- [ ] `src/components/Settings.tsx` — Group related settings into card-like sections with subtle borders and spacing
- [ ] `src/components/Settings.tsx` — Add section headers/dividers between groups
- [ ] `src/components/PlaylistModal.tsx` — Add `backdrop-blur-sm` to modal overlay
- [ ] `src/App.tsx` — Improve button active states: add `active:scale-[0.97]` to primary buttons
- [ ] `src/components/DownloadItem.tsx` — Add `active:scale-[0.97]` to cancel button
- [ ] Verify: settings looks grouped, modal has blur, buttons feel tactile on click

## Final Checklist

- [ ] All views work in RTL (Hebrew) and LTR (English)
- [ ] Dark and light themes both look correct
- [ ] Window resizes from 400×500 to large without breaking
- [ ] No new npm dependencies added
- [ ] No performance regressions (animations use transform/opacity)
