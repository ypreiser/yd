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
  // auto-update
  autoUpdate: string;
  autoUpdateOn: string;
  autoUpdateOff: string;
  enableAutoUpdate: string;
  autoUpdating: string;
  // rollback
  rollback: (version: string) => string;
  rollbackConfirm: (version: string) => string;
  rollingBack: string;
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
  autoUpdate: "Auto Update",
  autoUpdateOn: "On",
  autoUpdateOff: "Off",
  enableAutoUpdate: "Enable auto-update in Settings",
  autoUpdating: "Updating...",
  rollback: (v) => `Rollback to v${v}`,
  rollbackConfirm: (v) => `Rollback to v${v}? The app will restart.`,
  rollingBack: "Rolling back...",
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
  autoUpdate: "עדכון אוטומטי",
  autoUpdateOn: "פעיל",
  autoUpdateOff: "כבוי",
  enableAutoUpdate: "הפעל עדכון אוטומטי בהגדרות",
  autoUpdating: "מעדכן...",
  rollback: (v) => `חזור לגרסה ${v}`,
  rollbackConfirm: (v) => `לחזור לגרסה ${v}? האפליקציה תופעל מחדש.`,
  rollingBack: "חוזר לגרסה קודמת...",
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
