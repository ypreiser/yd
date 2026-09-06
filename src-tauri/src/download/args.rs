//! Building the yt-dlp command line.
//!
//! Kept apart from the process plumbing so the exact flags a download runs with
//! can be asserted in tests — this is also where every value that reaches a
//! command line is re-validated.

use crate::config::{AppConfig, ALLOWED_COOKIE_BROWSERS};

/// Pace requests so a batch does not look like a scraper.
///
/// Five parallel downloads hammering YouTube is exactly the pattern that earns
/// "Sign in to confirm you're not a bot". A second between metadata requests and
/// a short random gap before each download costs almost nothing on a single
/// download and materially reduces how often a batch trips the check. Retries
/// cover the transient 403/timeout that used to fail a download outright.
const PACING_ARGS: &[&str] = &[
    "--sleep-requests",
    "1",
    "--min-sleep-interval",
    "1",
    "--max-sleep-interval",
    "5",
    "--retries",
    "5",
    "--fragment-retries",
    "10",
    "--retry-sleep",
    "exp=1:30",
];

/// Build the yt-dlp cookie flags for the current config.
///
/// YouTube answers plain requests with "Sign in to confirm you're not a bot"
/// more and more often; passing cookies from a signed-in session is yt-dlp's
/// documented way around it.
///
/// Values are re-validated here (not only in `set_config`) so a hand-edited or
/// tampered config.json can never smuggle extra flags into the yt-dlp command
/// line: the browser must be on the allowlist, and the cookie file must be an
/// existing absolute path (which can never start with `-`).
pub fn cookie_args(config: &AppConfig) -> Vec<String> {
    match config.cookies_mode.as_str() {
        "browser" => {
            let browser = config.cookies_browser.trim();
            if ALLOWED_COOKIE_BROWSERS.contains(&browser) {
                vec!["--cookies-from-browser".to_string(), browser.to_string()]
            } else {
                Vec::new()
            }
        }
        "file" => {
            let raw = config.cookies_file.trim();
            let path = std::path::Path::new(raw);
            if path.is_absolute() && path.is_file() {
                vec!["--cookies".to_string(), raw.to_string()]
            } else {
                Vec::new()
            }
        }
        _ => Vec::new(),
    }
}

/// Every flag a download runs with, in order, ending with the URL.
///
/// The URL is passed through by the caller, which has already checked it with
/// `urls::is_valid_youtube_url` — nothing here can turn it into a flag.
pub fn download_args(
    config: &AppConfig,
    ffmpeg_location: &str,
    output_template: &str,
    url: &str,
) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    if config.embed_thumbnail {
        args.push("--embed-thumbnail".to_string());
    }

    // Cookies from a signed-in session, when configured — this is what gets
    // past "Sign in to confirm you're not a bot".
    args.extend(cookie_args(config));
    args.extend(PACING_ARGS.iter().map(|a| a.to_string()));

    args.extend(
        [
            // A watch URL carrying &list= would otherwise pull the whole
            // playlist under this one progress row. Playlists have their own
            // flow (fetch_playlist + the picker), which queues each entry.
            "--no-playlist",
            "-f",
            "bestaudio/best",
            "--recode-video",
            &config.audio_format,
            "--newline",
            "--progress",
            "--windows-filenames",
            "--ffmpeg-location",
            ffmpeg_location,
            "--print",
            "before_dl:YTDL_TITLE:%(title)s",
            "--print",
            "after_move:YTDL_FILEPATH:%(filepath)s",
            "-o",
            output_template,
            url,
        ]
        .map(String::from),
    );

    args
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;

    fn config(mode: &str, browser: &str, file: &str) -> AppConfig {
        AppConfig {
            cookies_mode: mode.to_string(),
            cookies_browser: browser.to_string(),
            cookies_file: file.to_string(),
            ..AppConfig::default()
        }
    }

    #[test]
    fn none_mode_adds_no_args() {
        assert!(cookie_args(&config("none", "chrome", "")).is_empty());
    }

    #[test]
    fn browser_mode_passes_allowlisted_browser() {
        assert_eq!(
            cookie_args(&config("browser", "firefox", "")),
            vec!["--cookies-from-browser".to_string(), "firefox".to_string()]
        );
    }

    #[test]
    fn browser_mode_rejects_unknown_browser() {
        assert!(cookie_args(&config("browser", "netscape", "")).is_empty());
    }

    #[test]
    fn browser_mode_rejects_injected_flags() {
        // A tampered config must not be able to append yt-dlp flags.
        assert!(cookie_args(&config("browser", "chrome --exec calc.exe", "")).is_empty());
        assert!(cookie_args(&config("browser", "--exec", "")).is_empty());
    }

    #[test]
    fn file_mode_rejects_relative_or_missing_paths() {
        assert!(cookie_args(&config("file", "", "cookies.txt")).is_empty());
        assert!(cookie_args(&config("file", "", "-cookies.txt")).is_empty());
        let missing = if cfg!(windows) {
            "C:\\definitely\\missing\\cookies.txt"
        } else {
            "/definitely/missing/cookies.txt"
        };
        assert!(cookie_args(&config("file", "", missing)).is_empty());
    }

    #[test]
    fn file_mode_passes_existing_absolute_path() {
        let dir = std::env::temp_dir().join("yd_cookie_args_test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("cookies.txt");
        std::fs::write(&file, "# Netscape HTTP Cookie File\n").unwrap();
        let path = file.to_string_lossy().to_string();

        assert_eq!(
            cookie_args(&config("file", "", &path)),
            vec!["--cookies".to_string(), path.clone()]
        );

        std::fs::remove_file(&file).ok();
    }

    #[test]
    fn unknown_mode_adds_no_args() {
        assert!(cookie_args(&config("magic", "chrome", "")).is_empty());
    }

    #[test]
    fn download_args_end_with_the_url() {
        let args = download_args(
            &config("none", "", ""),
            "/ffmpeg",
            "/music/%(title)s.%(ext)s",
            "https://youtu.be/abc",
        );
        assert_eq!(args.last().unwrap(), "https://youtu.be/abc");
    }

    #[test]
    fn download_args_never_expand_a_playlist() {
        let args = download_args(
            &config("none", "", ""),
            "/ffmpeg",
            "/o",
            "https://youtu.be/a",
        );
        assert!(args.iter().any(|a| a == "--no-playlist"));
    }

    #[test]
    fn download_args_use_the_configured_format() {
        let mut cfg = config("none", "", "");
        cfg.audio_format = "flac".to_string();
        let args = download_args(&cfg, "/ffmpeg", "/o", "https://youtu.be/a");
        let idx = args.iter().position(|a| a == "--recode-video").unwrap();
        assert_eq!(args[idx + 1], "flac");
    }

    #[test]
    fn download_args_include_thumbnail_flag_only_when_enabled() {
        let mut cfg = config("none", "", "");
        assert!(!download_args(&cfg, "/f", "/o", "u")
            .iter()
            .any(|a| a == "--embed-thumbnail"));

        cfg.embed_thumbnail = true;
        assert!(download_args(&cfg, "/f", "/o", "u")
            .iter()
            .any(|a| a == "--embed-thumbnail"));
    }

    #[test]
    fn download_args_carry_cookies_when_configured() {
        let args = download_args(
            &config("browser", "firefox", ""),
            "/f",
            "/o",
            "https://youtu.be/a",
        );
        let idx = args
            .iter()
            .position(|a| a == "--cookies-from-browser")
            .expect("cookie flag");
        assert_eq!(args[idx + 1], "firefox");
    }

    #[test]
    fn download_args_are_paced() {
        let args = download_args(&config("none", "", ""), "/f", "/o", "https://youtu.be/a");
        assert!(args.iter().any(|a| a == "--sleep-requests"));
        assert!(args.iter().any(|a| a == "--retries"));
    }
}
