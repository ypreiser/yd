mod config;
mod download;
mod hebrew;
mod history;
mod logging;
mod net;
mod signature;

use download::{DownloadState, SearchState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .manage(DownloadState::new())
        .manage(SearchState::new())
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::set_config,
            download::download,
            download::download_batch,
            download::cancel_download,
            download::search_youtube,
            download::fetch_playlist,
            download::get_ytdlp_version,
            download::check_ytdlp_update,
            download::update_ytdlp,
            download::check_binaries,
            download::check_disk_space,
            download::cancel_search,
            download::test_cookies,
            download::cookie_browser_is_chromium,
            logging::log_app_error,
            logging::error_log_info,
            logging::clear_error_log,
            logging::build_error_report,
            net::check_connectivity,
            history::history_list,
            history::history_remove,
            history::history_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
