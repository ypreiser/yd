pub fn contains_hebrew(s: &str) -> bool {
    s.chars().any(|c| ('\u{0590}'..='\u{05FF}').contains(&c))
}

/// Reverse characters within each contiguous Hebrew run, leave everything else in place.
/// "שלום hello" → "םולש hello"
pub fn reverse_hebrew(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::with_capacity(s.len());
    let mut i = 0;

    while i < chars.len() {
        if is_hebrew(chars[i]) {
            let start = i;
            while i < chars.len() && is_hebrew(chars[i]) {
                i += 1;
            }
            for c in chars[start..i].iter().rev() {
                result.push(*c);
            }
        } else {
            result.push(chars[i]);
            i += 1;
        }
    }

    result
}

fn is_hebrew(c: char) -> bool {
    ('\u{0590}'..='\u{05FF}').contains(&c)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contains_hebrew() {
        assert!(contains_hebrew("שלום"));
        assert!(contains_hebrew("hello שלום world"));
        assert!(!contains_hebrew("hello world"));
    }

    #[test]
    fn test_reverse_hebrew_segments() {
        assert_eq!(reverse_hebrew("שלום hello"), "םולש hello");
        assert_eq!(reverse_hebrew("שלום_REMIX_עולם"), "םולש_REMIX_םלוע");
        assert_eq!(reverse_hebrew("שלום"), "םולש");
        assert_eq!(reverse_hebrew("hello"), "hello");
    }
}
