export function isPlaylistUrl(url: string): boolean {
  return /[?&]list=/.test(url) || /\/playlist\?/.test(url)
    || /\/(channel|c|@)[/\w]/.test(url);
}
