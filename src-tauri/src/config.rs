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
    save_config(&app, &config)
}
