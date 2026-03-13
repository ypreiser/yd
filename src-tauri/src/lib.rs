mod config;
mod download;

use download::DownloadState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .manage(DownloadState::new())
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::set_config,
            download::download,
            download::download_batch,
            download::cancel_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
