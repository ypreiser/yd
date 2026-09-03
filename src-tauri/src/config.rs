use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub download_dir: String,
    pub audio_format: String,
    pub theme: String,
    pub language: String,
    pub auto_update: bool,
    pub embed_title: bool,
    pub embed_thumbnail: bool,
    pub flip_hebrew_in_title: bool,
    /// How cookies are supplied to yt-dlp: "none", "browser" or "file".
    /// Needed when YouTube answers with "Sign in to confirm you're not a bot".
    pub cookies_mode: String,
    /// Browser to read cookies from when `cookies_mode == "browser"`.
    pub cookies_browser: String,
    /// Absolute path to a Netscape-format cookies.txt when `cookies_mode == "file"`.
    pub cookies_file: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let download_dir = dirs::download_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .to_string_lossy()
            .to_string();
        Self {
            download_dir,
            audio_format: "m4a".to_string(),
            theme: "dark".to_string(),
            language: "he".to_string(),
            auto_update: false,
            embed_title: false,
            embed_thumbnail: false,
            flip_hebrew_in_title: false,
            cookies_mode: "none".to_string(),
            cookies_browser: String::new(),
            cookies_file: String::new(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let path = config_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> AppConfig {
    load_config(&app)
}

const ALLOWED_AUDIO_FORMATS: &[&str] = &["m4a", "mp3", "opus", "flac"];
const ALLOWED_THEMES: &[&str] = &["dark", "light"];
const ALLOWED_LANGUAGES: &[&str] = &["en", "he"];
pub const ALLOWED_COOKIE_MODES: &[&str] = &["none", "browser", "file"];
/// Browsers yt-dlp can read cookies from. Kept as a strict allowlist so a value
/// from config.json can never be turned into an extra yt-dlp flag.
pub const ALLOWED_COOKIE_BROWSERS: &[&str] = &[
    "brave", "chrome", "chromium", "edge", "firefox", "opera", "safari", "vivaldi", "whale",
];

#[tauri::command]
pub fn set_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    if !ALLOWED_AUDIO_FORMATS.contains(&config.audio_format.as_str()) {
        return Err(format!("Invalid audio format: {}", config.audio_format));
    }
    let dir = std::path::Path::new(&config.download_dir);
    if !dir.is_absolute() {
        return Err("Download directory must be an absolute path".to_string());
    }
    if !ALLOWED_THEMES.contains(&config.theme.as_str()) {
        return Err("Invalid theme".to_string());
    }
    if !ALLOWED_LANGUAGES.contains(&config.language.as_str()) {
        return Err("Invalid language".to_string());
    }
    if !ALLOWED_COOKIE_MODES.contains(&config.cookies_mode.as_str()) {
        return Err("Invalid cookies mode".to_string());
    }
    match config.cookies_mode.as_str() {
        "browser" => {
            if !ALLOWED_COOKIE_BROWSERS.contains(&config.cookies_browser.as_str()) {
                return Err("Invalid cookies browser".to_string());
            }
        }
        "file" => {
            let path = std::path::Path::new(&config.cookies_file);
            if !path.is_absolute() {
                return Err("Cookies file must be an absolute path".to_string());
            }
            if !path.is_file() {
                return Err("Cookies file does not exist".to_string());
            }
        }
        _ => {}
    }
    save_config(&app, &config)
}
