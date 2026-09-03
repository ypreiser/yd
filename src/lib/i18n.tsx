import { createContext, useContext } from "react";

export type Language = "en" | "he";

export interface Translations {
  appTitle: string;
  settings: string;
  back: string;
  download: string;
  downloadN: (n: number) => string;
  urlPlaceholder: string;
  noDownloads: string;
  cancel: string;
  // status
  queued: string;
  downloading: string;
  converting: string;
  done: string;
  already_exists: string;
  cancelled: string;
  error: string;
  // settings
  downloadDir: string;
  audioFormat: string;
  language: string;
  theme: string;
  browse: string;
  save: string;
  themeDark: string;
  themeLight: string;
  version: string;
  // search
  search: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  searchError: string;
  addToDownload: string;
  // playlist
  playlist: string;
  playlistVideos: (n: number) => string;
  selectAll: string;
  deselectAll: string;
  downloadSelected: (n: number) => string;
  loadingPlaylist: string;
  playlistError: string;
  close: string;
  // update
  updateAvailable: string;
  updateDownloading: string;
  updateReady: string;
  updateNow: string;
  checkForUpdates: string;
  upToDate: string;
  // yt-dlp
  ytdlpVersion: string;
  ytdlpUpdateAvailable: (latest: string) => string;
  ytdlpUpdating: string;
  ytdlpUpToDate: string;
  ytdlpUpdateError: string;
  checkForYtdlpUpdate: string;
  updateYtdlp: string;
  // auto-update
  autoUpdate: string;
  autoUpdateOn: string;
  autoUpdateOff: string;
  enableAutoUpdate: string;
  autoUpdating: string;
  missingBinaries: (bins: string) => string;
  paste: string;
  clearFinished: string;
  openFolder: string;
  retry: string;
  lowDiskSpace: string;
  stop: string;
  embedTitle: string;
  embedThumbnail: string;
  flipHebrewInTitle: string;
  metadata: string;
  // cookies
  cookies: string;
  cookiesHelp: string;
  cookiesNone: string;
  cookiesFromBrowser: string;
  cookiesFromFile: string;
  cookiesBrowser: string;
  cookiesFile: string;
  cookiesWarning: string;
  settingsSaveError: string;
  // connection
  connection: string;
  online: string;
  offline: string;
  youtubeUnreachable: string;
  // cookie instructions
  cookiesHowTo: string;
  cookiesStepsBrowser: string[];
  cookiesStepsFile: string[];
  cookiesGuideLink: string;
  // problem reports
  reportProblem: string;
  reportHelp: string;
  prepareReport: string;
  reportConsent: string;
  copyReport: string;
  reportCopied: string;
  openGithubIssue: string;
  openLogFolder: string;
  clearLog: string;
  logEntries: (n: number) => string;
  reportError: string;
  // yt-dlp error messages
  errVideoNotAvailable: string;
  errVideoUnavailable: string;
  errPrivateVideo: string;
  errAgeRestricted: string;
  errVideoRemoved: string;
  errBotCheck: string;
  errCookiesInvalid: string;
}

const en: Translations = {
  appTitle: "YD",
  settings: "Settings",
  back: "Back",
  download: "Download",
  downloadN: (n) => `Download ${n} songs`,
  urlPlaceholder: "Paste YouTube URLs or any text containing them\nURLs are auto-detected",
  noDownloads: "No downloads yet",
  cancel: "Cancel",
  queued: "Queued",
  downloading: "Downloading",
  converting: "Converting",
  done: "Done",
  already_exists: "Already exists",
  cancelled: "Cancelled",
  error: "Error",
  downloadDir: "Download Directory",
  audioFormat: "Audio Format",
  language: "Language",
  theme: "Theme",
  browse: "Browse",
  save: "Save",
  themeDark: "Dark",
  themeLight: "Light",
  version: "Version",
  search: "Search",
  searchPlaceholder: "Search YouTube...",
  searching: "Searching...",
  noResults: "No results found",
  searchError: "Search failed",
  addToDownload: "Download",
  playlist: "Playlist",
  playlistVideos: (n) => `${n} videos`,
  selectAll: "Select all",
  deselectAll: "Deselect all",
  downloadSelected: (n) => `Download ${n} selected`,
  loadingPlaylist: "Loading playlist...",
  playlistError: "Failed to load playlist",
  close: "Close",
  updateAvailable: "Update available",
  updateDownloading: "Downloading update...",
  updateReady: "Update ready — restart to apply",
  updateNow: "Restart",
  checkForUpdates: "Check for updates",
  upToDate: "Up to date",
  ytdlpVersion: "yt-dlp Version",
  ytdlpUpdateAvailable: (v) => `Update available: ${v}`,
  ytdlpUpdating: "Updating yt-dlp...",
  ytdlpUpToDate: "Up to date",
  ytdlpUpdateError: "Update failed",
  checkForYtdlpUpdate: "Check",
  updateYtdlp: "Update",
  autoUpdate: "Auto Update",
  autoUpdateOn: "On",
  autoUpdateOff: "Off",
  enableAutoUpdate: "Enable auto-update in Settings",
  autoUpdating: "Updating...",
  missingBinaries: (bins) => `Missing required binaries: ${bins}. See README for setup.`,
  paste: "Paste",
  clearFinished: "Clear finished",
  openFolder: "Open folder",
  retry: "Retry",
  lowDiskSpace: "Low disk space in download directory. Continue anyway?",
  stop: "Stop",
  embedTitle: "Embed Title",
  embedThumbnail: "Embed Thumbnail",
  flipHebrewInTitle: "Flip Hebrew in Title",
  metadata: "Metadata",
  cookies: "YouTube Cookies",
  cookiesHelp:
    "Use cookies from a signed-in YouTube session when YouTube asks you to confirm you're not a bot.",
  cookiesNone: "None",
  cookiesFromBrowser: "From browser",
  cookiesFromFile: "cookies.txt file",
  cookiesBrowser: "Browser",
  cookiesFile: "Cookies file",
  cookiesWarning:
    "Cookies give this app access to your YouTube account. Prefer a throwaway account, and keep the cookies.txt file private.",
  settingsSaveError: "Could not save settings",
  connection: "Connection",
  online: "Online",
  offline: "Offline",
  youtubeUnreachable: "YouTube unreachable",
  cookiesHowTo: "How do I get cookies?",
  cookiesStepsBrowser: [
    "Sign in to YouTube in the browser you pick below.",
    "Close that browser completely — it locks its cookie database while running.",
    "Pick the browser and press Save, then start a download.",
    "On Windows, Chrome/Edge/Brave usually refuse to hand over cookies. If it keeps failing, use the cookies.txt option instead.",
  ],
  cookiesStepsFile: [
    "Install a cookies.txt exporter extension in your browser (search the store for \"Get cookies.txt\").",
    "Open a private/incognito window and sign in to youtube.com there.",
    "Play any video for a second, then export cookies for youtube.com to a .txt file.",
    "Close the private window WITHOUT logging out — logging out invalidates the cookies you just saved.",
    "Press Browse below, pick the file, and Save.",
  ],
  cookiesGuideLink: "yt-dlp cookie export guide",
  reportProblem: "Report a Problem",
  reportHelp:
    "Errors are written to a local log file. Nothing is sent anywhere unless you choose to send it.",
  prepareReport: "Prepare report",
  reportConsent:
    "Review the report below. \"Open GitHub issue\" opens your browser with this text pre-filled — you still choose to submit it.",
  copyReport: "Copy",
  reportCopied: "Copied",
  openGithubIssue: "Open GitHub issue",
  openLogFolder: "Open log folder",
  clearLog: "Clear log",
  logEntries: (n) => `${n} logged errors`,
  reportError: "Could not build the report",
  errVideoNotAvailable: "This video is not available",
  errVideoUnavailable: "Video unavailable",
  errPrivateVideo: "This is a private video",
  errAgeRestricted: "Age-restricted video — sign-in required",
  errVideoRemoved: "This video has been removed",
  errBotCheck:
    "YouTube asked to confirm you're not a bot. Open Settings → YouTube Cookies and supply cookies from your browser or a cookies.txt file (updating yt-dlp can help too).",
  errCookiesInvalid:
    "The YouTube cookies are no longer valid. Sign in to YouTube again and re-export them in Settings → YouTube Cookies.",
};

const he: Translations = {
  appTitle: "YD",
  settings: "הגדרות",
  back: "חזרה",
  download: "הורדה",
  downloadN: (n) => `הורד ${n} שירים`,
  urlPlaceholder: "הדבק כתובות YouTube או כל טקסט שמכיל אותן\nהכתובות מזוהות אוטומטית",
  noDownloads: "אין הורדות עדיין",
  cancel: "ביטול",
  queued: "בתור",
  downloading: "מוריד",
  converting: "ממיר",
  done: "הושלם",
  already_exists: "כבר קיים",
  cancelled: "בוטל",
  error: "שגיאה",
  downloadDir: "תיקיית הורדות",
  audioFormat: "פורמט שמע",
  language: "שפה",
  theme: "ערכת נושא",
  browse: "עיון",
  save: "שמירה",
  themeDark: "כהה",
  themeLight: "בהיר",
  version: "גרסה",
  search: "חיפוש",
  searchPlaceholder: "חיפוש ביוטיוב...",
  searching: "מחפש...",
  noResults: "לא נמצאו תוצאות",
  searchError: "החיפוש נכשל",
  addToDownload: "הורדה",
  playlist: "רשימת השמעה",
  playlistVideos: (n) => `${n} סרטונים`,
  selectAll: "בחר הכל",
  deselectAll: "בטל בחירה",
  downloadSelected: (n) => `הורד ${n} נבחרים`,
  loadingPlaylist: "טוען רשימת השמעה...",
  playlistError: "טעינת הרשימה נכשלה",
  close: "סגור",
  updateAvailable: "עדכון זמין",
  updateDownloading: "מוריד עדכון...",
  updateReady: "העדכון מוכן — הפעל מחדש להחלה",
  updateNow: "הפעל מחדש",
  checkForUpdates: "בדוק עדכונים",
  upToDate: "מעודכן",
  ytdlpVersion: "גרסת yt-dlp",
  ytdlpUpdateAvailable: (v) => `עדכון זמין: ${v}`,
  ytdlpUpdating: "מעדכן yt-dlp...",
  ytdlpUpToDate: "מעודכן",
  ytdlpUpdateError: "העדכון נכשל",
  checkForYtdlpUpdate: "בדוק",
  updateYtdlp: "עדכן",
  autoUpdate: "עדכון אוטומטי",
  autoUpdateOn: "פעיל",
  autoUpdateOff: "כבוי",
  enableAutoUpdate: "הפעל עדכון אוטומטי בהגדרות",
  autoUpdating: "מעדכן...",
  missingBinaries: (bins) => `קבצים חסרים: ${bins}. ראה README להתקנה.`,
  paste: "הדבקה",
  clearFinished: "נקה הושלמו",
  openFolder: "פתח תיקייה",
  retry: "נסה שוב",
  lowDiskSpace: "מקום נמוך בדיסק בתיקיית ההורדות. להמשיך בכל זאת?",
  stop: "עצור",
  embedTitle: "הטמע כותרת",
  embedThumbnail: "הטמע תמונה ממוזערת",
  flipHebrewInTitle: "הפוך עברית בכותרת",
  metadata: "מטא-דאטה",
  cookies: "עוגיות YouTube",
  cookiesHelp:
    "השתמש בעוגיות מחשבון YouTube מחובר כאשר יוטיוב מבקש לאמת שאינך רובוט.",
  cookiesNone: "ללא",
  cookiesFromBrowser: "מהדפדפן",
  cookiesFromFile: "קובץ cookies.txt",
  cookiesBrowser: "דפדפן",
  cookiesFile: "קובץ עוגיות",
  cookiesWarning:
    "העוגיות מעניקות לאפליקציה גישה לחשבון YouTube שלך. עדיף להשתמש בחשבון נפרד, ולשמור על קובץ ה-cookies.txt פרטי.",
  settingsSaveError: "שמירת ההגדרות נכשלה",
  connection: "חיבור",
  online: "מחובר",
  offline: "לא מחובר",
  youtubeUnreachable: "אין גישה ליוטיוב",
  cookiesHowTo: "איך משיגים עוגיות?",
  cookiesStepsBrowser: [
    "התחבר ליוטיוב בדפדפן שתבחר למטה.",
    "סגור את הדפדפן לגמרי — כל עוד הוא פועל הוא נועל את מסד העוגיות.",
    "בחר את הדפדפן, לחץ שמירה והתחל הורדה.",
    "בחלונות, Chrome/Edge/Brave לרוב לא מאפשרים קריאת עוגיות. אם זה ממשיך להיכשל, השתמש באפשרות קובץ cookies.txt.",
  ],
  cookiesStepsFile: [
    "התקן בדפדפן תוסף לייצוא cookies.txt (חפש בחנות \"Get cookies.txt\").",
    "פתח חלון פרטי/גלישה בסתר והתחבר שם ל-youtube.com.",
    "הפעל סרטון כלשהו לרגע, ואז ייצא את העוגיות של youtube.com לקובץ txt.",
    "סגור את החלון הפרטי בלי להתנתק — התנתקות מבטלת את העוגיות שייצאת.",
    "לחץ עיון למטה, בחר את הקובץ ושמור.",
  ],
  cookiesGuideLink: "מדריך ייצוא עוגיות של yt-dlp",
  reportProblem: "דיווח על תקלה",
  reportHelp:
    "שגיאות נכתבות לקובץ יומן מקומי. שום דבר לא נשלח לשום מקום אלא אם תבחר לשלוח.",
  prepareReport: "הכן דוח",
  reportConsent:
    "עבור על הדוח למטה. \"פתח דיווח ב-GitHub\" יפתח את הדפדפן עם הטקסט הזה מוכן — השליחה עדיין בידיים שלך.",
  copyReport: "העתק",
  reportCopied: "הועתק",
  openGithubIssue: "פתח דיווח ב-GitHub",
  openLogFolder: "פתח תיקיית יומן",
  clearLog: "נקה יומן",
  logEntries: (n) => `${n} שגיאות ביומן`,
  reportError: "בניית הדוח נכשלה",
  errVideoNotAvailable: "הסרטון אינו זמין",
  errVideoUnavailable: "הסרטון אינו זמין",
  errPrivateVideo: "זהו סרטון פרטי",
  errAgeRestricted: "סרטון מוגבל גיל — נדרשת התחברות",
  errVideoRemoved: "הסרטון הוסר",
  errBotCheck:
    "יוטיוב ביקש לאמת שאינך רובוט. פתח הגדרות ← עוגיות YouTube וספק עוגיות מהדפדפן או קובץ cookies.txt (גם עדכון yt-dlp עשוי לעזור).",
  errCookiesInvalid:
    "העוגיות של YouTube אינן תקפות עוד. התחבר שוב ליוטיוב וייצא אותן מחדש בהגדרות ← עוגיות YouTube.",
};

const locales: Record<Language, Translations> = { en, he };

export function getTranslations(lang: Language): Translations {
  return locales[lang] || locales.en;
}

export const I18nContext = createContext<Translations>(en);

export function useT(): Translations {
  return useContext(I18nContext);
}

export function isRTL(lang: Language): boolean {
  return lang === "he";
}

const ERROR_PATTERNS: [RegExp, keyof Translations][] = [
  [/This video is not available/i, "errVideoNotAvailable"],
  [/Video unavailable/i, "errVideoUnavailable"],
  [/Private video/i, "errPrivateVideo"],
  [/Sign in to confirm your age/i, "errAgeRestricted"],
  [/This video has been removed/i, "errVideoRemoved"],
  // Curly or straight apostrophe, and yt-dlp keeps rewording the sentence,
  // so match loosely on the distinctive part.
  [/Sign in to confirm[\s\S]{0,20}not a bot/i, "errBotCheck"],
  [/cookies are no longer valid/i, "errCookiesInvalid"],
];

export function translateError(raw: string, t: Translations): string {
  for (const [pattern, key] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return t[key] as string;
  }
  return raw;
}
