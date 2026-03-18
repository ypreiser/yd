Performance

- Throttle progress events - yt-dlp emits progress very frequently. Every event triggers a React state update (new Map copy). Debouncing to ~200ms intervals would reduce renders significantly during downloads.
- Virtualize the download list - If users batch-download many files, rendering 50+ DownloadItem components gets slow. A virtual list (e.g. react-window) would help, though probably overkill unless you expect  
  heavy batch use.

UX Quick Wins

- Drag & drop URLs - Let users drop text/URLs onto the window instead of only paste.
- "Open folder" button - After download completes, a button to open the download directory (you already have tauri-plugin-opener).
- Clear finished downloads - A "Clear all" button for completed items, rather than just the silent 50-item cap.
- Download error retry - A retry button on failed downloads.
- Paste button - One-click paste from clipboard next to the URL input (useful on some platforms where paste shortcuts are awkward).

Features Worth Adding

- Download history / queue persistence - If the app crashes or closes, all in-progress context is lost. Persisting the queue to disk would let users resume.
- Notification on completion - System notification when a batch finishes (Tauri supports this natively).
- Audio preview - Play a short preview from search results before downloading.
- open in browser
- add title,thumbnail, metadata, HE flip - "שלום world" -> "םולש world"

Robustness

- yt-dlp version check - yt-dlp breaks often when YouTube changes things. A startup check that warns users if their bundled version is outdated would prevent confusing errors.
- Disk space check - Before starting a large batch, check available disk space in the download directory.
- Concurrent search cancellation - If a user types a new search while one is running, the old yt-dlp process keeps running. You should cancel it.
