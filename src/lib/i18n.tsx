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
}

const en: Translations = {
  appTitle: "YD",
  settings: "Settings",
  back: "Back",
  download: "Download",
  downloadN: (n) => `Download ${n} songs`,
  urlPlaceholder: "Paste YouTube URL(s) here\nOne per line for batch download",
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
};

const he: Translations = {
  appTitle: "YD",
  settings: "הגדרות",
  back: "חזרה",
  download: "הורדה",
  downloadN: (n) => `הורד ${n} שירים`,
  urlPlaceholder: "הדבק כתובות YouTube כאן\nאחת בכל שורה להורדה מרובה",
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
