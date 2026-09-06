//! Persistent record of completed downloads.
//!
//! The download list lives in React state, so closing the app lost everything:
//! what you already have, where it went, and what to re-download after a failed
//! batch. History is a small JSON file in the app data dir, capped so it cannot
//! grow without bound.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// Entries kept; the oldest fall off the end.
const MAX_ENTRIES: usize = 500;

/// Downloads finish concurrently, and each one rewrites the whole file — this
/// serialises the read-modify-write so two finishing at once cannot clobber
/// each other.
static WRITE_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    /// Absolute path of the saved file, when yt-dlp reported one.
    pub file_path: Option<String>,
    pub format: String,
    /// Unix seconds, UTC.
    pub completed_at: u64,
}

fn history_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("history.json"))
}

fn read_all(app: &tauri::AppHandle) -> Vec<HistoryEntry> {
    let Some(path) = history_path(app) else {
        return Vec::new();
    };
    let Ok(data) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    // A corrupt or half-written file must not break the app — start over.
    serde_json::from_str(&data).unwrap_or_default()
}

fn write_all(app: &tauri::AppHandle, entries: &[HistoryEntry]) -> Result<(), String> {
    let path = history_path(app).ok_or("no app data dir")?;
    let data = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    // Write-then-rename so a crash mid-write cannot truncate the history.
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, data).map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| e.to_string())
}

/// Record a finished download. Newest first, de-duplicated by URL so
/// re-downloading a song moves it up instead of listing it twice.
pub fn record(
    app: &tauri::AppHandle,
    url: &str,
    title: &str,
    file_path: Option<String>,
    format: &str,
) {
    let _guard = WRITE_LOCK.lock();

    let mut entries = read_all(app);
    entries.retain(|e| e.url != url);
    entries.insert(
        0,
        HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            url: url.to_string(),
            title: title.to_string(),
            file_path,
            format: format.to_string(),
            completed_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        },
    );
    entries.truncate(MAX_ENTRIES);

    if let Err(e) = write_all(app, &entries) {
        // History is a convenience; never fail a download over it.
        crate::logging::log_error(app, "history-write", &e);
    }
}

#[tauri::command]
pub fn history_list(app: tauri::AppHandle) -> Vec<HistoryEntry> {
    read_all(&app)
}

#[tauri::command]
pub fn history_remove(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock();
    let mut entries = read_all(&app);
    entries.retain(|e| e.id != id);
    write_all(&app, &entries)
}

#[tauri::command]
pub fn history_clear(app: tauri::AppHandle) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock();
    write_all(&app, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(url: &str, title: &str) -> HistoryEntry {
        HistoryEntry {
            id: url.to_string(),
            url: url.to_string(),
            title: title.to_string(),
            file_path: None,
            format: "m4a".to_string(),
            completed_at: 0,
        }
    }

    /// Mirrors what `record` does to the list, without needing an AppHandle.
    fn insert(entries: &mut Vec<HistoryEntry>, new: HistoryEntry) {
        entries.retain(|e| e.url != new.url);
        entries.insert(0, new);
        entries.truncate(MAX_ENTRIES);
    }

    #[test]
    fn newest_entry_comes_first() {
        let mut entries = vec![entry("a", "A")];
        insert(&mut entries, entry("b", "B"));
        assert_eq!(entries[0].url, "b");
    }

    #[test]
    fn re_downloading_moves_an_entry_up_instead_of_duplicating_it() {
        let mut entries = vec![entry("a", "A"), entry("b", "B")];
        insert(&mut entries, entry("b", "B again"));
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].url, "b");
        assert_eq!(entries[0].title, "B again");
    }

    #[test]
    fn caps_the_list() {
        let mut entries: Vec<HistoryEntry> = (0..MAX_ENTRIES)
            .map(|i| entry(&format!("url-{}", i), "t"))
            .collect();
        insert(&mut entries, entry("newest", "t"));
        assert_eq!(entries.len(), MAX_ENTRIES);
        assert_eq!(entries[0].url, "newest");
    }

    #[test]
    fn corrupt_history_parses_as_empty() {
        let parsed: Vec<HistoryEntry> = serde_json::from_str("{not json").unwrap_or_default();
        assert!(parsed.is_empty());
    }

    #[test]
    fn entries_survive_a_round_trip() {
        let entries = vec![HistoryEntry {
            id: "1".into(),
            url: "https://youtu.be/x".into(),
            title: "שיר".into(),
            file_path: Some("C:\\Music\\song.m4a".into()),
            format: "m4a".into(),
            completed_at: 1_700_000_000,
        }];
        let json = serde_json::to_string(&entries).unwrap();
        let back: Vec<HistoryEntry> = serde_json::from_str(&json).unwrap();
        assert_eq!(back[0].title, "שיר");
        assert_eq!(back[0].file_path.as_deref(), Some("C:\\Music\\song.m4a"));
    }
}
