use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::sync::{Mutex, Semaphore};
use uuid::Uuid;

static PROGRESS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+([\d.]+)%").unwrap());

const ALLOWED_AUDIO_FORMATS: &[&str] = &["m4a", "mp3", "opus", "flac"];

use crate::config::load_config;

const MAX_CONCURRENT: usize = 5;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: String,
    pub channel: String,
    pub thumbnail: String,
}

#[tauri::command]
pub async fn search_youtube(
    app: tauri::AppHandle,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let sidecar = app
        .shell()
        .sidecar("yt-dlp")
        .expect("yt-dlp sidecar not found")
        .env("PYTHONUTF8", "1")
        .args([
            "--flat-playlist",
            "--no-download",
            "--add-header", "Cookie:PREF=f2=8000000",
            "--print", "%(id)s\t%(title)s\t%(url)s\t%(duration_string)s\t%(channel)s\t%(thumbnails.0.url)s",
            &format!("ytsearch10:{}", query),
        ]);

    let output = sidecar.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = decode_output(&output.stderr);
        return Err(stderr);
    }

    let stdout = decode_output(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(6, '\t').collect();
        if parts.len() >= 2 {
            let video_id = parts[0];
            let title = parts[1].to_string();
            let url = if parts.len() > 2 && !parts[2].is_empty() && parts[2] != "NA" {
                parts[2].to_string()
            } else {
                format!("https://www.youtube.com/watch?v={}", video_id)
            };
            let duration = if parts.len() > 3 && parts[3] != "NA" {
                parts[3].to_string()
            } else {
                String::new()
            };
            let channel = if parts.len() > 4 && parts[4] != "NA" {
                parts[4].to_string()
            } else {
                String::new()
            };
            let thumbnail = if parts.len() > 5 && parts[5] != "NA" {
                parts[5].to_string()
            } else {
                format!("https://i.ytimg.com/vi/{}/mqdefault.jpg", video_id)
            };

            results.push(SearchResult {
                id: video_id.to_string(),
                title,
                url,
                duration,
                channel,
                thumbnail,
            });
        }
    }

    Ok(results)
}

/// Decode process output bytes, handling Windows ANSI code pages (Hebrew, etc.)
fn decode_output(bytes: &[u8]) -> String {
    // Try UTF-8 first (works if PYTHONUTF8=1 is effective)
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    // Fall back to Windows system ANSI code page
    #[cfg(windows)]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        extern "system" {
            fn MultiByteToWideChar(
                code_page: u32,
                flags: u32,
                src: *const u8,
                src_len: i32,
                dst: *mut u16,
                dst_len: i32,
            ) -> i32;
        }

        const CP_ACP: u32 = 0; // system default ANSI code page

        unsafe {
            let wide_len = MultiByteToWideChar(
                CP_ACP, 0,
                bytes.as_ptr(), bytes.len() as i32,
                std::ptr::null_mut(), 0,
            );
            if wide_len > 0 {
                let mut wide = vec![0u16; wide_len as usize];
                MultiByteToWideChar(
                    CP_ACP, 0,
                    bytes.as_ptr(), bytes.len() as i32,
                    wide.as_mut_ptr(), wide_len,
                );
                return OsString::from_wide(&wide).to_string_lossy().to_string();
            }
        }
    }

    String::from_utf8_lossy(bytes).to_string()
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub id: String,
    pub url: String,
    pub percent: f64,
    pub title: Option<String>,
    pub status: String, // "downloading", "converting", "done", "error"
    pub error: Option<String>,
}

type ChildMap = Arc<Mutex<HashMap<String, u32>>>;
type CancelledSet = Arc<Mutex<std::collections::HashSet<String>>>;

pub struct DownloadState {
    pub children: ChildMap,
    pub cancelled: CancelledSet,
    pub semaphore: Arc<Semaphore>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            children: Arc::new(Mutex::new(HashMap::new())),
            cancelled: Arc::new(Mutex::new(std::collections::HashSet::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT)),
        }
    }
}

fn ffmpeg_location() -> String {
    // Tauri places all sidecar binaries next to the main exe (no triple suffix)
    let exe = std::env::current_exe().expect("no exe path");
    let exe_dir = exe.parent().expect("no parent dir");
    exe_dir.to_string_lossy().to_string()
}

#[tauri::command]
fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(unix)]
    {
        // Kill the process group (negative PID) to terminate child processes too
        unsafe {
            libc::kill(-(pid as i32), libc::SIGTERM);
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlaylistInfo {
    pub title: String,
    pub entries: Vec<PlaylistEntry>,
}

#[tauri::command]
pub async fn fetch_playlist(
    app: tauri::AppHandle,
    url: String,
) -> Result<PlaylistInfo, String> {
    if !is_valid_youtube_url(&url) {
        return Err("Invalid URL: only YouTube URLs are allowed".to_string());
    }

    let sidecar = app
        .shell()
        .sidecar("yt-dlp")
        .expect("yt-dlp sidecar not found")
        .env("PYTHONUTF8", "1")
        .args([
            "--flat-playlist",
            "--no-download",
            "--print", "playlist:YTDL_PLAYLIST_TITLE:%(playlist_title)s",
            "--print", "%(id)s\t%(title)s\t%(url)s\t%(duration_string)s\t%(thumbnails.0.url)s",
            &url,
        ]);

    let output = sidecar.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = decode_output(&output.stderr);
        return Err(stderr);
    }

    let stdout = decode_output(&output.stdout);
    let mut playlist_title = String::new();
    let mut entries = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some(title) = line.strip_prefix("YTDL_PLAYLIST_TITLE:") {
            if playlist_title.is_empty() && title != "NA" {
                playlist_title = title.to_string();
            }
            continue;
        }

        let parts: Vec<&str> = line.splitn(5, '\t').collect();
        if parts.len() >= 2 {
            let video_id = parts[0];
            let title = parts[1].to_string();
            let url = format!("https://www.youtube.com/watch?v={}", video_id);
            let duration = if parts.len() > 3 && parts[3] != "NA" {
                parts[3].to_string()
            } else {
                String::new()
            };
            let thumbnail = if parts.len() > 4 && parts[4] != "NA" {
                parts[4].to_string()
            } else {
                format!("https://i.ytimg.com/vi/{}/mqdefault.jpg", video_id)
            };

            entries.push(PlaylistEntry {
                id: video_id.to_string(),
                title,
                url,
                duration,
                thumbnail,
            });
        }
    }

    if entries.is_empty() {
        return Err("No entries found in playlist".to_string());
    }

    Ok(PlaylistInfo {
        title: playlist_title,
        entries,
    })
}

fn is_valid_youtube_url(url: &str) -> bool {
    let url = url.trim();
    url.starts_with("https://www.youtube.com/")
        || url.starts_with("http://www.youtube.com/")
        || url.starts_with("https://youtube.com/")
        || url.starts_with("http://youtube.com/")
        || url.starts_with("https://youtu.be/")
        || url.starts_with("http://youtu.be/")
        || url.starts_with("https://music.youtube.com/")
        || url.starts_with("http://music.youtube.com/")
}

#[tauri::command]
pub async fn download(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    if !is_valid_youtube_url(&url) {
        return Err("Invalid URL: only YouTube URLs are allowed".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let config = load_config(&app);

    if !ALLOWED_AUDIO_FORMATS.contains(&config.audio_format.as_str()) {
        return Err(format!("Invalid audio format: {}", config.audio_format));
    }
    let state = app.state::<DownloadState>();
    let semaphore = state.semaphore.clone();
    let children = state.children.clone();
    let cancelled = state.cancelled.clone();
    let ffmpeg_path = ffmpeg_location();

    let id_clone = id.clone();
    let url_clone = url.clone();

    // Emit initial state
    app.emit(
        "download-progress",
        DownloadProgress {
            id: id.clone(),
            url: url.clone(),
            percent: 0.0,
            title: None,
            status: "queued".to_string(),
            error: None,
        },
    )
    .ok();

    tauri::async_runtime::spawn(async move {
        let _permit = semaphore.acquire().await.expect("semaphore closed");

        app.emit(
            "download-progress",
            DownloadProgress {
                id: id_clone.clone(),
                url: url_clone.clone(),
                percent: 0.0,
                title: None,
                status: "downloading".to_string(),
                error: None,
            },
        )
        .ok();

        let sidecar = app
            .shell()
            .sidecar("yt-dlp")
            .expect("yt-dlp sidecar not found")
            .env("PYTHONUTF8", "1")
            .args([
                "--extract-audio",
                "--audio-format",
                &config.audio_format,
                "--newline",
                "--progress",
                "--ffmpeg-location",
                &ffmpeg_path,
                "--print", "before_dl:YTDL_TITLE:%(title)s",
                "-o",
                &format!("{}/%(title)s.%(ext)s", config.download_dir),
                &url_clone,
            ]);

        let result = sidecar.spawn();

        match result {
            Ok((mut rx, child)) => {
                {
                    let mut map = children.lock().await;
                    map.insert(id_clone.clone(), child.pid());
                }

                let mut title: Option<String> = None;
                let mut last_stderr = String::new();

                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stderr(ref line_bytes) | CommandEvent::Stdout(ref line_bytes) => {
                            let is_stderr = matches!(event, CommandEvent::Stderr(_));
                            let line = decode_output(line_bytes);
                            let line = line.trim();

                            // Track last non-empty stderr line for error reporting
                            if is_stderr && !line.is_empty() {
                                last_stderr = line.to_string();
                            }

                            // Extract title from --print output
                            if title.is_none() {
                                if let Some(t) = line.strip_prefix("YTDL_TITLE:") {
                                    title = Some(t.to_string());
                                }
                            }

                            // Extract progress percentage
                            if let Some(caps) = PROGRESS_RE.captures(line) {
                                if let Ok(pct) = caps[1].parse::<f64>() {
                                    let status = if line.contains("[ExtractAudio]") || line.contains("Post-process") {
                                        "converting"
                                    } else {
                                        "downloading"
                                    };
                                    app.emit(
                                        "download-progress",
                                        DownloadProgress {
                                            id: id_clone.clone(),
                                            url: url_clone.clone(),
                                            percent: pct,
                                            title: title.clone(),
                                            status: status.to_string(),
                                            error: None,
                                        },
                                    )
                                    .ok();
                                }
                            }

                            if line.contains("[ExtractAudio]") {
                                app.emit(
                                    "download-progress",
                                    DownloadProgress {
                                        id: id_clone.clone(),
                                        url: url_clone.clone(),
                                        percent: 100.0,
                                        title: title.clone(),
                                        status: "converting".to_string(),
                                        error: None,
                                    },
                                )
                                .ok();
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            let was_cancelled = cancelled.lock().await.remove(&id_clone);
                            let success = payload.code == Some(0);
                            let (status, error) = if was_cancelled {
                                ("cancelled".to_string(), None)
                            } else if success {
                                ("done".to_string(), None)
                            } else {
                                ("error".to_string(), Some(if last_stderr.is_empty() {
                                    format!("yt-dlp exited with code {:?}", payload.code)
                                } else {
                                    last_stderr.clone()
                                }))
                            };
                            app.emit(
                                "download-progress",
                                DownloadProgress {
                                    id: id_clone.clone(),
                                    url: url_clone.clone(),
                                    percent: if success { 100.0 } else { 0.0 },
                                    title: title.clone(),
                                    status,
                                    error,
                                },
                            )
                            .ok();
                            break;
                        }
                        _ => {}
                    }
                }

                {
                    let mut map = children.lock().await;
                    map.remove(&id_clone);
                }
            }
            Err(e) => {
                app.emit(
                    "download-progress",
                    DownloadProgress {
                        id: id_clone.clone(),
                        url: url_clone.clone(),
                        percent: 0.0,
                        title: None,
                        status: "error".to_string(),
                        error: Some(e.to_string()),
                    },
                )
                .ok();
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn download_batch(
    app: tauri::AppHandle,
    urls: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut ids = Vec::new();
    for url in urls {
        let url = url.trim().to_string();
        if url.is_empty() {
            continue;
        }
        let id = download(app.clone(), url).await?;
        ids.push(id);
    }
    Ok(ids)
}

#[tauri::command]
pub async fn cancel_download(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<DownloadState>();
    let children = state.children.clone();
    let map = children.lock().await;
    if let Some(pid) = map.get(&id) {
        state.cancelled.lock().await.insert(id);
        kill_process_tree(*pid)?;
        Ok(())
    } else {
        Err("download not found or already finished".to_string())
    }
}
