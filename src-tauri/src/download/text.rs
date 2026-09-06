//! Turning yt-dlp's console output into things the UI can use.

use regex::Regex;
use std::sync::LazyLock;

static PROGRESS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+([\d.]+)%").unwrap());

/// Percentage from a `[download]  42.0% of ...` line, if it is one.
pub fn parse_progress_percent(line: &str) -> Option<f64> {
    PROGRESS_RE
        .captures(line)
        .and_then(|caps| caps[1].parse::<f64>().ok())
}

pub fn decode_output(bytes: &[u8]) -> String {
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

        let src_len = match i32::try_from(bytes.len()) {
            Ok(n) => n,
            Err(_) => return String::from_utf8_lossy(bytes).to_string(),
        };

        unsafe {
            let wide_len =
                MultiByteToWideChar(CP_ACP, 0, bytes.as_ptr(), src_len, std::ptr::null_mut(), 0);
            if wide_len > 0 {
                let mut wide = vec![0u16; wide_len as usize];
                MultiByteToWideChar(
                    CP_ACP,
                    0,
                    bytes.as_ptr(),
                    src_len,
                    wide.as_mut_ptr(),
                    wide_len,
                );
                return OsString::from_wide(&wide).to_string_lossy().to_string();
            }
        }
    }

    String::from_utf8_lossy(bytes).to_string()
}

// --- Structs ---

pub fn sanitize_windows_filename(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '"' => '\u{FF02}',  // ＂
            '*' => '\u{FF0A}',  // ＊
            ':' => '\u{FF1A}',  // ：
            '<' => '\u{FF1C}',  // ＜
            '>' => '\u{FF1E}',  // ＞
            '?' => '\u{FF1F}',  // ？
            '\\' => '\u{FF3C}', // ＼
            '|' => '\u{FF5C}',  // ｜
            '/' => '\u{FF0F}',  // ／
            _ => c,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_percentage_out_of_a_progress_line() {
        assert_eq!(
            parse_progress_percent("[download]   4.2% of 3.50MiB at 1.00MiB/s"),
            Some(4.2)
        );
        assert_eq!(
            parse_progress_percent("[download] 100% of 3.50MiB"),
            Some(100.0)
        );
    }

    #[test]
    fn ignores_lines_that_are_not_progress() {
        assert_eq!(parse_progress_percent("[youtube] Extracting URL"), None);
        assert_eq!(parse_progress_percent("ERROR: something went wrong"), None);
        assert_eq!(parse_progress_percent(""), None);
    }

    #[test]
    fn decodes_utf8_unchanged() {
        assert_eq!(decode_output("שיר בעברית".as_bytes()), "שיר בעברית");
        assert_eq!(decode_output(b"plain ascii"), "plain ascii");
    }

    #[test]
    fn decoding_never_panics_on_invalid_bytes() {
        // Lone continuation byte: not valid UTF-8 anywhere.
        let decoded = decode_output(&[0x41, 0x80, 0x42]);
        assert!(!decoded.is_empty());
    }

    #[test]
    fn replaces_characters_windows_forbids_in_filenames() {
        let out = sanitize_windows_filename(r#"a"b*c:d<e>f?g\h|i/j"#);
        for bad in ['"', '*', ':', '<', '>', '?', '\\', '|', '/'] {
            assert!(!out.contains(bad), "{:?} survived sanitising", bad);
        }
    }

    #[test]
    fn leaves_ordinary_titles_alone() {
        assert_eq!(
            sanitize_windows_filename("Never Gonna Give You Up"),
            "Never Gonna Give You Up"
        );
        assert_eq!(sanitize_windows_filename("שיר"), "שיר");
    }
}
