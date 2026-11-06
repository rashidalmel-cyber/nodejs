import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import english from "./translations.json";

const LanguageContext = createContext(null);
const storageKey = "madar-language";

function initialLanguage() {
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage);
  const direction = language === "ar" ? "rtl" : "ltr";
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    try {
      localStorage.setItem(storageKey, language);
    } catch {
      /* Language switching also works without persistent storage. */
    }
  }, [language, direction]);
  const t = useCallback(
    (key, values = {}) => {
      const text =
        language === "en" && Object.hasOwn(english, key) ? english[key] : key;
      return typeof text === "string"
        ? text.replace(/\{(\w+)\}/g, (match, name) =>
            String(values[name] ?? match),
          )
        : text;
    },
    [language],
  );
  const value = useMemo(
    () => ({
      language,
      direction,
      locale: language === "ar" ? "ar-LB" : "en-US",
      setLanguage,
      t,
    }),
    [language, direction, t],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useI18n = () => useContext(LanguageContext);
