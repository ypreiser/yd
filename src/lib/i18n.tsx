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
