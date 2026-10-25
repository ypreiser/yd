//! Connectivity probe behind the online/offline indicator.
//!
//! The webview's `navigator.onLine` only knows whether a network interface is
//! up, which is why it happily reports "online" on a captive-portal Wi-Fi. This
//! makes one cheap request to a no-content endpoint to find out what is actually
//! reachable, and separates "no internet" from "internet, but YouTube blocked" —
//! the difference matters a lot when a download fails.

use serde::Serialize;
use std::time::Duration;

const PROBE_TIMEOUT: Duration = Duration::from_secs(6);
/// Returns 204 with an empty body — cheapest reachability check YouTube offers.
const YOUTUBE_PROBE: &str = "https://www.youtube.com/generate_204";
/// Neutral fallback used only to tell "offline" apart from "YouTube blocked".
const INTERNET_PROBE: &str = "https://www.cloudflare.com/cdn-cgi/trace";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Connectivity {
    /// Some host on the internet answered.
    pub online: bool,
    /// YouTube itself answered.
    pub youtube: bool,
}

async fn reachable(client: &reqwest::Client, url: &str) -> bool {
    client.get(url).send().await.is_ok()
}

/// Probe connectivity. Never fails — an error is just "not reachable".
#[tauri::command]
pub async fn check_connectivity() -> Connectivity {
    let client = match reqwest::Client::builder().timeout(PROBE_TIMEOUT).build() {
        Ok(c) => c,
        Err(_) => {
            return Connectivity {
                online: false,
                youtube: false,
            }
        }
    };

    if reachable(&client, YOUTUBE_PROBE).await {
        return Connectivity {
            online: true,
            youtube: true,
        };
    }

    Connectivity {
        online: reachable(&client, INTERNET_PROBE).await,
        youtube: false,
    }
}
