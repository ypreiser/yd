//! Local error log + user-reviewed problem reports.
//!
//! Errors are appended to `<app data>/logs/errors.log`, redacted on the way in
//! (home directory, user name and any cookie value are stripped) and rotated so
//! the file can never grow without bound. Nothing is ever sent anywhere by the
//! app itself: `build_error_report` only returns text, which the UI shows to the
//! user before they choose to file it as a GitHub issue.

use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;
use tauri::Manager;

/// Rotate once the log passes this size; one previous file is kept.
const MAX_LOG_BYTES: u64 = 256 * 1024;
/// Longest single entry kept (a yt-dlp traceback can be huge).
const MAX_ENTRY_CHARS: usize = 2000;
/// Entries included in a generated report.
const REPORT_ENTRIES: usize = 40;

static COOKIE_FLAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(--cookies-from-browser|--cookies)(\s+|=)\S+").unwrap());
static COOKIE_HEADER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(cookie:)\s*\S+").unwrap());

fn logs_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("logs");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn log_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    Some(logs_dir(app)?.join("errors.log"))
}

/// Format a UTC timestamp without pulling in a date library.
/// (civil-from-days, Howard Hinnant's algorithm)
fn format_utc(unix_secs: u64) -> String {
    let days = (unix_secs / 86_400) as i64;
    let secs_of_day = unix_secs % 86_400;
    let (hour, minute, second) = (
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60,
    );

    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let day = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let month = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Strip anything user-identifying or secret before a line is written to disk.
///
/// The log is meant to be pasted into a public GitHub issue, so this runs on
/// write (not on read) — a report can never be more revealing than the file.
pub fn redact(input: &str) -> String {
    // One error is one entry, so flatten line breaks (CRLF first, so a Windows
    // line ending does not become two spaces).
    let mut out = input.replace("\r\n", " ").replace(['\n', '\r'], " ");

    out = COOKIE_FLAG_RE
        .replace_all(&out, "$1 <redacted>")
        .to_string();
    out = COOKIE_HEADER_RE
        .replace_all(&out, "$1 <redacted>")
        .to_string();

    if let Some(home) = dirs::home_dir() {
        let home_str = home.to_string_lossy().to_string();
        if !home_str.is_empty() {
            out = out.replace(&home_str, "~");
            // Windows paths in yt-dlp output often come back with forward slashes
            out = out.replace(&home_str.replace('\\', "/"), "~");
        }
        if let Some(user) = home.file_name().and_then(|n| n.to_str()) {
            if user.len() > 2 {
                out = out.replace(user, "<user>");
            }
        }
    }

    if out.chars().count() > MAX_ENTRY_CHARS {
        out = out.chars().take(MAX_ENTRY_CHARS).collect::<String>() + " …[truncated]";
    }
    out
}

fn rotate_if_needed(path: &PathBuf) {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_BYTES {
            let _ = fs::rename(path, path.with_extension("1.log"));
        }
    }
}

/// Append one redacted entry. Logging must never break the app, so every
/// failure here is swallowed.
pub fn log_error(app: &tauri::AppHandle, context: &str, message: &str) {
    let Some(path) = log_file(app) else {
        return;
    };
    rotate_if_needed(&path);

    let entry = format!(
        "[{}] {}: {}\n",
        format_utc(now_secs()),
        redact(context),
        redact(message)
    );

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(entry.as_bytes());
    }
}

/// Let the frontend record its own failures (search, playlist, uncaught errors).
#[tauri::command]
pub fn log_app_error(app: tauri::AppHandle, context: String, message: String) {
    log_error(&app, &context, &message);
}

fn read_entries(app: &tauri::AppHandle, limit: usize) -> Vec<String> {
    let Some(path) = log_file(app) else {
        return Vec::new();
    };
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
    lines
        .iter()
        .rev()
        .take(limit)
        .rev()
        .map(|l| l.to_string())
        .collect()
}

#[derive(Serialize)]
pub struct LogInfo {
    pub path: String,
    pub entries: usize,
}

/// Where the log lives and how much is in it (for the Settings screen).
#[tauri::command]
pub fn error_log_info(app: tauri::AppHandle) -> Result<LogInfo, String> {
    let path = log_file(&app).ok_or("no app data dir")?;
    // Make sure the file exists so the UI can reveal it in the file manager.
    if !path.exists() {
        let _ = fs::write(&path, "");
    }
    let entries = fs::read_to_string(&path)
        .map(|c| c.lines().filter(|l| !l.trim().is_empty()).count())
        .unwrap_or(0);
    Ok(LogInfo {
        path: path.to_string_lossy().to_string(),
        entries,
    })
}

#[tauri::command]
pub fn clear_error_log(app: tauri::AppHandle) -> Result<(), String> {
    let path = log_file(&app).ok_or("no app data dir")?;
    fs::write(&path, "").map_err(|e| e.to_string())?;
    let _ = fs::remove_file(path.with_extension("1.log"));
    Ok(())
}

/// Build the text the user can review and paste into a bug report.
///
/// Deliberately excludes anything the user has not already seen: no download
/// paths, no cookie file location, no URLs beyond what a logged error contained
/// (and those went through `redact` on the way in).
#[tauri::command]
pub fn build_error_report(app: tauri::AppHandle, ytdlp_version: Option<String>) -> String {
    let config = crate::config::load_config(&app);
    let entries = read_entries(&app, REPORT_ENTRIES);

    let cookies = match config.cookies_mode.as_str() {
        "browser" => format!("browser ({})", config.cookies_browser),
        "file" => "cookies.txt file".to_string(),
        _ => "none".to_string(),
    };

    let mut report = String::new();
    report.push_str("### Environment\n");
    report.push_str(&format!(
        "- App: YD {}\n- OS: {} {}\n- yt-dlp: {}\n- Audio format: {}\n- Cookies: {}\n- Embed title/thumbnail: {}/{}\n- Generated: {}\n",
        app.package_info().version,
        std::env::consts::OS,
        std::env::consts::ARCH,
        ytdlp_version.unwrap_or_else(|| "unknown".to_string()),
        config.audio_format,
        cookies,
        config.embed_title,
        config.embed_thumbnail,
        format_utc(now_secs()),
    ));

    report.push_str(&format!("\n### Recent errors ({})\n", entries.len()));
    if entries.is_empty() {
        report.push_str("_none recorded_\n");
    } else {
        report.push_str("```\n");
        for entry in entries {
            report.push_str(&entry);
            report.push('\n');
        }
        report.push_str("```\n");
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_epoch() {
        assert_eq!(format_utc(0), "1970-01-01 00:00:00Z");
    }

    #[test]
    fn formats_known_timestamp() {
        // 2023-11-14T22:13:20Z
        assert_eq!(format_utc(1_700_000_000), "2023-11-14 22:13:20Z");
    }

    #[test]
    fn formats_leap_day() {
        // 2024-02-29T12:00:00Z
        assert_eq!(format_utc(1_709_208_000), "2024-02-29 12:00:00Z");
    }

    #[test]
    fn redacts_cookie_flags() {
        let out = redact("yt-dlp --cookies-from-browser firefox --cookies /home/me/cookies.txt");
        assert!(out.contains("--cookies-from-browser <redacted>"));
        assert!(out.contains("--cookies <redacted>"));
        assert!(!out.contains("firefox"));
        assert!(!out.contains("cookies.txt"));
    }

    #[test]
    fn redacts_cookie_headers() {
        let out = redact("--add-header Cookie:SID=secretvalue");
        assert!(!out.contains("secretvalue"));
    }

    #[test]
    fn collapses_newlines_so_one_error_is_one_entry() {
        assert_eq!(redact("a\nb\r\nc"), "a b c");
    }

    #[test]
    fn truncates_very_long_entries() {
        let out = redact(&"x".repeat(MAX_ENTRY_CHARS * 2));
        assert!(out.ends_with("…[truncated]"));
        assert!(out.chars().count() < MAX_ENTRY_CHARS + 20);
    }
}
