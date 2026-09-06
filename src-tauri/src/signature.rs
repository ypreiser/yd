//! OpenPGP verification of yt-dlp's release checksums.
//!
//! The self-update used to trust `SHA2-256SUMS` on its own. That file and the
//! binary come from the same origin, so the hash only proved the download was
//! not corrupted in transit — it proved nothing about who produced it. yt-dlp
//! publishes `SHA2-256SUMS.sig`, a detached signature made with its release
//! signing key, so verifying that against a key pinned in this binary is what
//! turns the checksum into a real integrity check.
//!
//! The pinned key is `keys/ytdlp-signing-key.asc`
//! (`AC0C BBE6 848D 6A87 3464  AF4E 57CF 6593 3B5A 7581`, "Simon Sawicki
//! (yt-dlp signing key)"). If yt-dlp ever rotates it, updates start failing
//! with a signature error until this app ships the new key — that is the
//! intended failure direction: refuse rather than install unverified code.

use pgp::composed::{Deserializable, DetachedSignature, SignedPublicKey};
use pgp::types::KeyDetails;

/// yt-dlp's release signing key, pinned at build time.
const YTDLP_SIGNING_KEY: &str = include_str!("../keys/ytdlp-signing-key.asc");

/// Fingerprint the pinned key must have. Guards against a wrong or swapped key
/// file — the fingerprint is a hash of the key material, so this is not
/// something a bad key can fake.
const YTDLP_KEY_FINGERPRINT: &str = "ac0cbbe6848d6a873464af4e57cf65933b5a7581";

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Verify a detached OpenPGP signature over `data` using the pinned yt-dlp key.
///
/// Returns the signer's fingerprint on success. Any failure — malformed input,
/// unknown signer, bad signature — is an error; there is no "probably fine".
pub fn verify_ytdlp_checksums(data: &[u8], signature: &[u8]) -> Result<String, String> {
    let (key, _) = SignedPublicKey::from_armor_single(std::io::Cursor::new(YTDLP_SIGNING_KEY))
        .map_err(|e| format!("pinned signing key is unreadable: {}", e))?;

    let fingerprint = hex(key.fingerprint().as_bytes());
    if fingerprint != YTDLP_KEY_FINGERPRINT {
        return Err(format!(
            "pinned signing key has unexpected fingerprint {}",
            fingerprint
        ));
    }

    let sig = DetachedSignature::from_bytes(std::io::Cursor::new(signature))
        .map_err(|e| format!("signature is unreadable: {}", e))?;

    // The signature may come from the primary key or any of its subkeys.
    if sig.verify(&key, data).is_ok() {
        return Ok(fingerprint);
    }
    for subkey in &key.public_subkeys {
        if sig.verify(subkey, data).is_ok() {
            return Ok(fingerprint);
        }
    }

    Err("checksum signature does not verify against yt-dlp's signing key".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A real SHA2-256SUMS / SHA2-256SUMS.sig pair from a yt-dlp release.
    const SUMS: &[u8] = include_bytes!("../fixtures/SHA2-256SUMS");
    const SIG: &[u8] = include_bytes!("../fixtures/SHA2-256SUMS.sig");

    #[test]
    fn accepts_a_genuine_signature() {
        let fingerprint = verify_ytdlp_checksums(SUMS, SIG).expect("genuine signature");
        assert_eq!(fingerprint, YTDLP_KEY_FINGERPRINT);
    }

    #[test]
    fn rejects_tampered_checksums() {
        // Flip one character of one hash — the attack this exists to stop.
        let mut tampered = SUMS.to_vec();
        tampered[0] = if tampered[0] == b'a' { b'b' } else { b'a' };
        assert!(verify_ytdlp_checksums(&tampered, SIG).is_err());
    }

    #[test]
    fn rejects_an_appended_line() {
        let mut extended = SUMS.to_vec();
        extended.extend_from_slice(
            b"0000000000000000000000000000000000000000000000000000000000000000  yt-dlp.exe\n",
        );
        assert!(verify_ytdlp_checksums(&extended, SIG).is_err());
    }

    #[test]
    fn rejects_a_corrupted_signature() {
        let mut broken = SIG.to_vec();
        let last = broken.len() - 1;
        broken[last] ^= 0xff;
        assert!(verify_ytdlp_checksums(SUMS, &broken).is_err());
    }

    #[test]
    fn rejects_garbage_signature() {
        assert!(verify_ytdlp_checksums(SUMS, b"not a signature").is_err());
    }
}
