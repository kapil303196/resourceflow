"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dictionaries,
  type Locale,
  type DictKey,
  LOCALES,
} from "@/lib/i18n/dictionaries";

const LOCALE_TO_INTL: Record<Locale, { locale: string; numberingSystem?: string }> = {
  en: { locale: "en-IN" },
  hi: { locale: "hi-IN", numberingSystem: "deva" },
  gu: { locale: "gu-IN", numberingSystem: "gujr" },
};

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: DictKey) => string;
  /** Localized number with locale-appropriate digits (Devanagari for Hindi, Gujarati for Gujarati). */
  fmtNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  /** Localized currency. amount is in MINOR units (paise/cents). */
  fmtMoney: (amountMinor: number, currency?: string) => string;
  /** Localized tonnage. */
  fmtTonnage: (n: number | string | undefined | null, unit?: string) => string;
  /** Localized date. */
  fmtDate: (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "resourceflow.locale";

function detectInitial(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && LOCALES.includes(saved)) return saved;
  const nav = navigator.language?.slice(0, 2);
  if (nav === "hi") return "hi";
  if (nav === "gu") return "gu";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Hydrate from storage on mount to keep server/client markup identical.
  useEffect(() => {
    setLocaleState(detectInitial());
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  };

  const value = useMemo<Ctx>(() => {
    const intl = LOCALE_TO_INTL[locale];
    const numberOpts = (extra?: Intl.NumberFormatOptions): Intl.NumberFormatOptions => ({
      ...(intl.numberingSystem ? { numberingSystem: intl.numberingSystem as any } : {}),
      ...(extra ?? {}),
    });
    return {
      locale,
      setLocale,
      t: (k) => dictionaries[locale]?.[k] ?? dictionaries.en[k] ?? String(k),
      fmtNumber: (n, opts) =>
        new Intl.NumberFormat(intl.locale, numberOpts(opts)).format(Number.isFinite(n) ? n : 0),
      fmtMoney: (amountMinor, currency = "INR") => {
        const value = (amountMinor ?? 0) / 100;
        try {
          return new Intl.NumberFormat(
            intl.locale,
            numberOpts({ style: "currency", currency, maximumFractionDigits: 2 }),
          ).format(value);
        } catch {
          return `${currency} ${value.toFixed(2)}`;
        }
      },
      fmtTonnage: (n, unit = "Tons") => {
        const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
        if (!Number.isFinite(num)) return `0 ${unit}`;
        return `${new Intl.NumberFormat(intl.locale, numberOpts({ maximumFractionDigits: 3 })).format(num)} ${unit}`;
      },
      fmtDate: (date, opts) =>
        new Intl.DateTimeFormat(
          intl.locale,
          opts ?? { day: "2-digit", month: "short", year: "numeric" },
        ).format(typeof date === "string" || typeof date === "number" ? new Date(date) : date),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback when used before provider mounts (e.g. server snapshot)
    const fallback = LOCALE_TO_INTL.en;
    return {
      locale: "en",
      setLocale: () => {},
      t: (k) => dictionaries.en[k] ?? String(k),
      fmtNumber: (n, opts) => new Intl.NumberFormat(fallback.locale, opts).format(n ?? 0),
      fmtMoney: (m, currency = "INR") =>
        new Intl.NumberFormat(fallback.locale, { style: "currency", currency }).format((m ?? 0) / 100),
      fmtTonnage: (n, unit = "Tons") => `${Number(n ?? 0).toFixed(2)} ${unit}`,
      fmtDate: (d) => new Date(d as any).toLocaleDateString(),
    };
  }
  return ctx;
}
