use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::sync::{Mutex, Semaphore};
use uuid::Uuid;

use crate::config::load_config;

const MAX_CONCURRENT: usize = 5;

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

pub struct DownloadState {
    pub children: ChildMap,
    pub semaphore: Arc<Semaphore>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            children: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT)),
        }
    }
}

fn ffmpeg_sidecar_path(app: &tauri::AppHandle) -> String {
    let resolver = app.path();
    let resource_dir = resolver.resource_dir().expect("no resource dir");
    let ffmpeg_path = resource_dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe");
    ffmpeg_path.to_string_lossy().to_string()
}

#[tauri::command]
pub async fn download(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let config = load_config(&app);
    let state = app.state::<DownloadState>();
    let semaphore = state.semaphore.clone();
    let children = state.children.clone();
    let ffmpeg_path = ffmpeg_sidecar_path(&app);

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
            .args([
                "--extract-audio",
                "--audio-format",
                &config.audio_format,
                "--newline",
                "--progress",
                "--ffmpeg-location",
                &ffmpeg_path,
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

                let progress_re = Regex::new(r"\[download\]\s+([\d.]+)%").unwrap();
                let title_re = Regex::new(r"\[download\] Destination: .*/(.+)\.\w+$").unwrap();
                let title_re2 = Regex::new(r"\[download\] Destination: (.+)\.\w+$").unwrap();
                let mut title: Option<String> = None;

                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) | CommandEvent::Stderr(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes);
                            let line = line.trim();

                            // Try to extract title
                            if title.is_none() {
                                if let Some(caps) = title_re.captures(line) {
                                    title = Some(caps[1].to_string());
                                } else if let Some(caps) = title_re2.captures(line) {
                                    title = Some(caps[1].to_string());
                                }
                            }

                            // Extract progress percentage
                            if let Some(caps) = progress_re.captures(line) {
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
                            let success = payload.code == Some(0);
                            app.emit(
                                "download-progress",
                                DownloadProgress {
                                    id: id_clone.clone(),
                                    url: url_clone.clone(),
                                    percent: if success { 100.0 } else { 0.0 },
                                    title: title.clone(),
                                    status: if success { "done" } else { "error" }.to_string(),
                                    error: if success {
                                        None
                                    } else {
                                        Some(format!("yt-dlp exited with code {:?}", payload.code))
                                    },
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
        // Kill the process tree on Windows
        std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("download not found or already finished".to_string())
    }
}
