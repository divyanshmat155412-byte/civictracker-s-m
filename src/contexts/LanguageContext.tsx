import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Language, translations, TranslationKey } from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => translations[key]?.en || key,
});

export const useLanguage = () => useContext(LanguageContext);

const syncHtmlLang = (lang: Language) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
  document.documentElement.setAttribute("dir", "ltr"); // Hindi is LTR
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("app-language");
    return (saved === "hi" ? "hi" : "en") as Language;
  });

  // Reflect language on <html> so :lang(hi) CSS, screen readers, and font fallbacks apply
  useEffect(() => {
    syncHtmlLang(language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { window.localStorage.setItem("app-language", lang); } catch { /* ignore */ }
    syncHtmlLang(lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[key]?.[language] || translations[key]?.en || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
