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
  // update
  updateAvailable: string;
  updateDownloading: string;
  updateReady: string;
  updateNow: string;
  checkForUpdates: string;
  upToDate: string;
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
  updateAvailable: "Update available",
  updateDownloading: "Downloading update...",
  updateReady: "Update ready — restart to apply",
  updateNow: "Restart",
  checkForUpdates: "Check for updates",
  upToDate: "Up to date",
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
  updateAvailable: "עדכון זמין",
  updateDownloading: "מוריד עדכון...",
  updateReady: "העדכון מוכן — הפעל מחדש להחלה",
  updateNow: "הפעל מחדש",
  checkForUpdates: "בדוק עדכונים",
  upToDate: "מעודכן",
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
