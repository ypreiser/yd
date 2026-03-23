use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, LazyLock};
use tauri::Emitter;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{Mutex, Semaphore};
use uuid::Uuid;

static PROGRESS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+([\d.]+)%").unwrap());

const ALLOWED_AUDIO_FORMATS: &[&str] = &["m4a", "mp3", "opus", "flac"];

use crate::config::load_config;

const MAX_CONCURRENT: usize = 5;

// --- yt-dlp path resolution ---

fn ytdlp_path(app: &tauri::AppHandle) -> PathBuf {
    // 1. Prefer user-updated binary in app data dir
    let app_data = app.path().app_data_dir().expect("no app data dir");
    let local = if cfg!(windows) {
        app_data.join("yt-dlp.exe")
    } else {
        app_data.join("yt-dlp")
    };
    if local.exists() {
        return local;
    }

    // 2. Bundled sidecar with target triple (dev mode)
    let exe = std::env::current_exe().expect("no exe path");
    let dir = exe.parent().expect("no parent dir");
    if cfg!(windows) {
        let with_triple = dir.join("yt-dlp-x86_64-pc-windows-msvc.exe");
        if with_triple.exists() {
            return with_triple;
        }
        // 3. Sidecar without triple (installed mode)
        let without_triple = dir.join("yt-dlp.exe");
        if without_triple.exists() {
            return without_triple;
        }
    } else {
        let p = dir.join("yt-dlp");
        if p.exists() {
            return p;
        }
    }

    // 4. System PATH fallback
    let cmd = if cfg!(windows) { "where" } else { "which" };
    if let Ok(output) = std::process::Command::new(cmd).arg("yt-dlp").output() {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = s.trim().lines().next() {
                let p = PathBuf::from(line);
                if p.exists() {
                    return p;
                }
            }
        }
    }

    // Return expected path (will fail exists() check)
    if cfg!(windows) {
        dir.join("yt-dlp-x86_64-pc-windows-msvc.exe")
    } else {
        dir.join("yt-dlp")
    }
}

fn ffmpeg_location() -> String {
    let exe = std::env::current_exe().expect("no exe path");
    let exe_dir = exe.parent().expect("no parent dir");
    exe_dir.to_string_lossy().to_string()
}

#[tauri::command]
pub async fn check_binaries(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut missing = Vec::new();

    let ytdlp = ytdlp_path(&app);
    if !ytdlp.exists() {
        missing.push("yt-dlp".to_string());
    }

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("no parent dir")?;
    let ffmpeg_exists = if cfg!(windows) {
        dir.join("ffmpeg-x86_64-pc-windows-msvc.exe").exists() || dir.join("ffmpeg.exe").exists()
    } else {
        dir.join("ffmpeg").exists()
    };
    if !ffmpeg_exists {
        missing.push("ffmpeg".to_string());
    }

    Ok(missing)
}

/// Run yt-dlp with args and return (stdout, stderr, success)
async fn run_ytdlp(
    app: &tauri::AppHandle,
    args: &[&str],
) -> Result<(Vec<u8>, Vec<u8>, bool), String> {
    let output = tokio::process::Command::new(ytdlp_path(app))
        .args(args)
        .env("PYTHONUTF8", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok((output.stdout, output.stderr, output.status.success()))
}

/// Decode process output bytes, handling Windows ANSI code pages (Hebrew, etc.)
fn decode_output(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

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

        const CP_ACP: u32 = 0;

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

// --- Structs ---

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: String,
    pub channel: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub id: String,
    pub url: String,
    pub percent: f64,
    pub title: Option<String>,
    pub status: String,
    pub error: Option<String>,
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

#[derive(Debug, Clone, Serialize)]
pub struct YtdlpUpdateInfo {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
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

pub struct SearchState {
    pub pid: Arc<Mutex<Option<u32>>>,
}

impl SearchState {
    pub fn new() -> Self {
        Self {
            pid: Arc::new(Mutex::new(None)),
        }
    }
}

fn kill_process_tree(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Ok(());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(unix)]
    {
        let ret = unsafe { libc::kill(pid as i32, libc::SIGTERM) };
        if ret != 0 {
            return Err(format!("kill failed: {}", std::io::Error::last_os_error()));
        }
    }
    Ok(())
}

fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() >= 3 {
            Some((parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?))
        } else {
            None
        }
    };
    match (parse(latest), parse(current)) {
        (Some(l), Some(c)) => l > c,
        _ => latest > current,
    }
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

// --- Disk space ---

#[tauri::command]
pub async fn check_disk_space(path: String) -> Result<u64, String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        extern "system" {
            fn GetDiskFreeSpaceExW(
                directory: *const u16,
                free_bytes_available: *mut u64,
                total_bytes: *mut u64,
                total_free_bytes: *mut u64,
            ) -> i32;
        }

        let wide: Vec<u16> = OsStr::new(&path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut free: u64 = 0;
        let mut _total: u64 = 0;
        let mut _total_free: u64 = 0;

        let result = unsafe {
            GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, &mut _total, &mut _total_free)
        };

        if result == 0 {
            return Err("Failed to check disk space".to_string());
        }

        Ok(free)
    }

    #[cfg(unix)]
    {
        use std::ffi::CString;

        let c_path = CString::new(path).map_err(|e| e.to_string())?;
        let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
        let result = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };

        if result != 0 {
            return Err("Failed to check disk space".to_string());
        }

        Ok(stat.f_bavail as u64 * stat.f_frsize as u64)
    }
}

// --- Commands ---

#[tauri::command]
pub async fn get_ytdlp_version(app: tauri::AppHandle) -> Result<String, String> {
    let (stdout, _, success) = run_ytdlp(&app, &["--version"]).await?;

    if !success {
        return Err("Failed to get yt-dlp version".to_string());
    }

    Ok(decode_output(&stdout).trim().to_string())
}

#[tauri::command]
pub async fn check_ytdlp_update(app: tauri::AppHandle) -> Result<YtdlpUpdateInfo, String> {
    let current = get_ytdlp_version(app).await?;

    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "yd-app")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let latest = resp["tag_name"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let update_available = !latest.is_empty() && version_is_newer(&latest, &current);

    Ok(YtdlpUpdateInfo {
        current,
        latest,
        update_available,
    })
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().expect("no app data dir");
    std::fs::create_dir_all(&app_data).ok();

    let (download_url, binary_name) = if cfg!(windows) {
        ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", "yt-dlp.exe")
    } else if cfg!(target_os = "macos") {
        ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos", "yt-dlp_macos")
    } else {
        ("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp", "yt-dlp")
    };

    let path = if cfg!(windows) {
        app_data.join("yt-dlp.exe")
    } else {
        app_data.join("yt-dlp")
    };

    let client = reqwest::Client::new();

    // Fetch SHA256 checksums from release
    let checksums_text = client
        .get("https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS")
        .header("User-Agent", "yd-app")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let expected_hash = checksums_text
        .lines()
        .find(|line| line.ends_with(binary_name))
        .and_then(|line| line.split_whitespace().next())
        .ok_or_else(|| format!("Checksum not found for {}", binary_name))?
        .to_string();

    // Download binary
    let bytes = client
        .get(download_url)
        .header("User-Agent", "yd-app")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    // Verify checksum before writing
    use sha2::{Sha256, Digest};
    let hash = format!("{:x}", Sha256::digest(&bytes));
    if hash != expected_hash {
        return Err(format!(
            "Checksum mismatch: expected {} got {}",
            expected_hash, hash
        ));
    }

    // Write to temp file, then rename
    let temp_path = path.with_extension("tmp");
    std::fs::write(&temp_path, &bytes).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temp_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }

    std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;

    // Verify new binary works
    get_ytdlp_version(app).await
}

#[tauri::command]
pub async fn cancel_search(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<SearchState>();
    let mut pid_lock = state.pid.lock().await;
    if let Some(pid) = pid_lock.take() {
        kill_process_tree(pid).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn search_youtube(
    app: tauri::AppHandle,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    // Cancel any in-progress search
    {
        let state = app.state::<SearchState>();
        let mut pid_lock = state.pid.lock().await;
        if let Some(old_pid) = pid_lock.take() {
            kill_process_tree(old_pid).ok();
        }
    }

    let query = query.trim().to_string();
    if query.is_empty() || query.len() > 200 {
        return Err("Invalid search query".to_string());
    }
    let query = query.trim_start_matches('-');
    let search_query = format!("ytsearch10:{}", query);

    let child = tokio::process::Command::new(ytdlp_path(&app))
        .args([
            "--flat-playlist",
            "--no-download",
            "--add-header", "Cookie:PREF=f2=8000000",
            "--print", "%(id)s\t%(title)s\t%(url)s\t%(duration_string)s\t%(channel)s\t%(thumbnails.0.url)s",
            &search_query,
        ])
        .env("PYTHONUTF8", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // Track PID for cancellation
    let pid = child.id().unwrap_or(0);
    {
        let state = app.state::<SearchState>();
        *state.pid.lock().await = Some(pid);
    }

    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    // Clear tracked PID
    {
        let state = app.state::<SearchState>();
        let mut pid_lock = state.pid.lock().await;
        if *pid_lock == Some(pid) {
            *pid_lock = None;
        }
    }

    let (stdout_bytes, stderr_bytes, success) = (output.stdout, output.stderr, output.status.success());

    if !success {
        return Err(decode_output(&stderr_bytes));
    }

    let stdout = decode_output(&stdout_bytes);
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

#[tauri::command]
pub async fn fetch_playlist(
    app: tauri::AppHandle,
    url: String,
) -> Result<PlaylistInfo, String> {
    if !is_valid_youtube_url(&url) {
        return Err("Invalid URL: only YouTube URLs are allowed".to_string());
    }

    let (stdout, stderr, success) = run_ytdlp(
        &app,
        &[
            "--flat-playlist",
            "--no-download",
            "--print", "playlist:YTDL_PLAYLIST_TITLE:%(playlist_title)s",
            "--print", "%(id)s\t%(title)s\t%(url)s\t%(duration_string)s\t%(thumbnails.0.url)s",
            &url,
        ],
    )
    .await?;

    if !success {
        return Err(decode_output(&stderr));
    }

    let stdout = decode_output(&stdout);
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
    let bin_path = ytdlp_path(&app);

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

        let output_template = format!("{}/%(title)s.%(ext)s", config.download_dir);
        let result = tokio::process::Command::new(&bin_path)
            .env("PYTHONUTF8", "1")
            .args([
                "-f", "bestaudio",
                "--recode-video",
                &config.audio_format,
                "--newline",
                "--progress",
                "--windows-filenames",
                "--ffmpeg-location",
                &ffmpeg_path,
                "--print", "before_dl:YTDL_TITLE:%(title)s",
                "-o",
                &output_template,
                &url_clone,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        match result {
            Ok(mut child) => {
                let pid = child.id().unwrap_or(0);
                if pid != 0 {
                    let mut map = children.lock().await;
                    map.insert(id_clone.clone(), pid);
                }

                let stdout = child.stdout.take().unwrap();
                let stderr = child.stderr.take().unwrap();

                // Merge stdout + stderr via channel (read raw bytes to handle non-UTF-8)
                let (tx, mut rx) = tokio::sync::mpsc::channel::<(bool, String)>(100);

                let tx_out = tx.clone();
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stdout);
                    let mut buf = Vec::new();
                    while reader.read_until(b'\n', &mut buf).await.unwrap_or(0) > 0 {
                        let line = decode_output(&buf);
                        let _ = tx_out.send((false, line)).await;
                        buf.clear();
                    }
                });

                let tx_err = tx;
                tokio::spawn(async move {
                    let mut reader = BufReader::new(stderr);
                    let mut buf = Vec::new();
                    while reader.read_until(b'\n', &mut buf).await.unwrap_or(0) > 0 {
                        let line = decode_output(&buf);
                        let _ = tx_err.send((true, line)).await;
                        buf.clear();
                    }
                });

                let mut title: Option<String> = None;
                let mut last_stderr = String::new();
                let mut already_exists = false;

                while let Some((is_stderr, line)) = rx.recv().await {
                    let line = line.trim().to_string();

                    if is_stderr && !line.is_empty() {
                        last_stderr = line.clone();
                    }

                    if line.contains("has already been downloaded") {
                        already_exists = true;
                    }

                    if title.is_none() {
                        if let Some(t) = line.strip_prefix("YTDL_TITLE:") {
                            title = Some(t.to_string());
                        }
                    }

                    if let Some(caps) = PROGRESS_RE.captures(&line) {
                        if let Ok(pct) = caps[1].parse::<f64>() {
                            let status = if line.contains("[ExtractAudio]") || line.contains("[VideoConvertor]") || line.contains("Post-process") {
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

                    if line.contains("[ExtractAudio]") || line.contains("[VideoConvertor]") {
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

                let exit = child.wait().await;
                let was_cancelled = cancelled.lock().await.remove(&id_clone);
                let success = exit.as_ref().map(|s| s.success()).unwrap_or(false);
                let exit_code = exit.ok().and_then(|s: std::process::ExitStatus| s.code());

                let (status, error): (String, Option<String>) = if was_cancelled {
                    ("cancelled".to_string(), None)
                } else if success && already_exists {
                    ("already_exists".to_string(), None)
                } else if success {
                    ("done".to_string(), None)
                } else {
                    (
                        "error".to_string(),
                        Some(if last_stderr.is_empty() {
                            format!("yt-dlp exited with code {:?}", exit_code)
                        } else {
                            last_stderr.clone()
                        }),
                    )
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

                {
                    let mut map = children.lock().await;
                    map.remove(&id_clone);
                }
            }
            Err(e) => {
                let err_str = e.to_string();
                // Clean up PID map in case it was inserted
                children.lock().await.remove(&id_clone);
                app.emit(
                    "download-progress",
                    DownloadProgress {
                        id: id_clone.clone(),
                        url: url_clone.clone(),
                        percent: 0.0,
                        title: None,
                        status: "error".to_string(),
                        error: Some(err_str),
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
    // Get PID then drop lock before acquiring cancelled lock (avoid deadlock)
    let pid = {
        let map = state.children.lock().await;
        map.get(&id).copied()
    };
    if let Some(pid) = pid {
        state.cancelled.lock().await.insert(id);
        kill_process_tree(pid)?;
        Ok(())
    } else {
        Err("download not found or already finished".to_string())
    }
}
