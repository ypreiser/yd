//! URL and version checks that decide what we are willing to hand to yt-dlp.

pub fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() >= 3 {
            Some((
                parts[0].parse().ok()?,
                parts[1].parse().ok()?,
                parts[2].parse().ok()?,
            ))
        } else {
            None
        }
    };
    match (parse(latest), parse(current)) {
        (Some(l), Some(c)) => l > c,
        _ => latest > current,
    }
}

pub fn is_valid_youtube_url(url: &str) -> bool {
    let url = url.trim();
    if url.len() > 2048 {
        return false;
    }
    url.starts_with("https://www.youtube.com/")
        || url.starts_with("https://youtube.com/")
        || url.starts_with("https://youtu.be/")
        || url.starts_with("https://music.youtube.com/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_youtube_hosts_we_support() {
        for url in [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        ] {
            assert!(is_valid_youtube_url(url), "{} should be accepted", url);
        }
    }

    #[test]
    fn rejects_other_hosts_and_schemes() {
        for url in [
            "http://www.youtube.com/watch?v=x", // plain HTTP
            "https://evil.com/watch?v=x",
            "https://www.youtube.com.evil.com/x", // lookalike host
            "https://vimeo.com/123",
            "file:///etc/passwd",
            "",
        ] {
            assert!(!is_valid_youtube_url(url), "{} should be rejected", url);
        }
    }

    #[test]
    fn rejects_anything_that_could_read_as_a_flag() {
        // yt-dlp would treat a leading dash as an option, not a URL.
        assert!(!is_valid_youtube_url("--exec=calc.exe"));
        assert!(!is_valid_youtube_url("-o /tmp/pwned"));
    }

    #[test]
    fn rejects_absurdly_long_urls() {
        let long = format!("https://www.youtube.com/watch?v={}", "a".repeat(4096));
        assert!(!is_valid_youtube_url(&long));
    }

    #[test]
    fn trims_surrounding_whitespace() {
        assert!(is_valid_youtube_url("  https://youtu.be/abc  "));
    }

    #[test]
    fn compares_yt_dlp_calendar_versions() {
        assert!(version_is_newer("2026.09.01", "2026.08.19"));
        assert!(version_is_newer("2027.01.01", "2026.12.31"));
        assert!(!version_is_newer("2026.08.19", "2026.08.19"));
        assert!(!version_is_newer("2026.08.19", "2026.09.01"));
    }
}
