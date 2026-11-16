import { useMemo, useSyncExternalStore } from "react";
import { createInstance } from "i18next";
import { initReactI18next, useTranslation as useReactTranslation } from "react-i18next";

import { APP_SETTINGS_STORAGE_KEY } from "../appSettingsStorage";
import {
  type LanguagePreference,
  type SupportedLocale,
  readLanguagePreference,
  resolveFormatLocale,
  resolveLanguagePreference,
  resolveLocale,
  UI_LOCALES,
} from "./locale";
import { uiLocalizationResources } from "@synara/shared/uiLocalizationResources";
import { UI_LOCALE_REGISTRY, isUiMessageKey } from "@synara/shared/uiLocale";

function browserLanguages(): readonly string[] {
  try {
    const nativeLanguages =
      typeof window === "undefined" ? undefined : window.desktopBridge?.getSystemLanguages?.();
    if (nativeLanguages?.length) return nativeLanguages;
  } catch {
    // An older or unavailable native bridge must not prevent the renderer from booting.
  }
  return globalThis.navigator?.languages?.length
    ? globalThis.navigator.languages
    : globalThis.navigator?.language
      ? [globalThis.navigator.language]
      : [];
}

function storedPreference(): LanguagePreference {
  return readLanguagePreference();
}

let preference = storedPreference();
let formatLocaleTag = resolveFormatLocale(
  preference,
  resolveLanguagePreference(preference) === "system" ? browserLanguages() : [],
);
const formatLocaleListeners = new Set<() => void>();

function publishFormatLocale(next: string): void {
  if (formatLocaleTag === next) return;
  formatLocaleTag = next;
  for (const listener of formatLocaleListeners) listener();
}

function subscribeFormatLocale(listener: () => void): () => void {
  formatLocaleListeners.add(listener);
  return () => {
    formatLocaleListeners.delete(listener);
  };
}

let synchronizedDesktopPreference:
  | {
      setter: NonNullable<NonNullable<Window["desktopBridge"]>["setLanguagePreference"]>;
      preference: LanguagePreference;
    }
  | undefined;

function syncDesktopLanguage(force = false): void {
  if (typeof window === "undefined") return;
  const bridge = window.desktopBridge;
  const setter = bridge?.setLanguagePreference;
  if (typeof setter !== "function") return;
  const nativePreference = resolveLanguagePreference(preference);
  if (
    !force &&
    synchronizedDesktopPreference?.setter === setter &&
    synchronizedDesktopPreference.preference === nativePreference
  )
    return;
  const pending = { setter, preference: nativePreference };
  synchronizedDesktopPreference = pending;
  const synchronize = async () => {
    try {
      await setter.call(bridge, pending.preference);
    } catch (error) {
      if (synchronizedDesktopPreference === pending) synchronizedDesktopPreference = undefined;
      console.warn("[i18n] Could not synchronize the native language preference.", error);
    }
  };
  void synchronize();
}

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: resolveLocale(
    preference,
    resolveLanguagePreference(preference) === "system" ? browserLanguages() : [],
  ),
  fallbackLng: "en",
  supportedLngs: [...UI_LOCALES],
  resources: uiLocalizationResources,
  ns: Object.keys(uiLocalizationResources.en),
  defaultNS: "common",
  initAsync: false,
  keySeparator: false,
  nsSeparator: ":",
  interpolation: { escapeValue: false },
  react: { useSuspense: false, transSupportBasicHtmlNodes: false },
});

export function t(message: string, values?: Record<string, unknown>): string {
  if (!isUiMessageKey(message, uiLocalizationResources.en)) return message;
  return i18n.t(message, { ...values, returnObjects: false });
}

export function useTranslation(): { t: typeof t; locale: string; formatLocale: string } {
  const { t: reactiveTranslator, i18n: instance } = useReactTranslation(undefined, { i18n });
  const formatLocale = useSyncExternalStore(
    subscribeFormatLocale,
    getFormatLocale,
    getFormatLocale,
  );
  // React Compiler needs a new identity on a language change. Delegating to the current
  // runtime also keeps callbacks already installed in native menus/event listeners current.
  const snapshot = useMemo(
    () => ({
      t: (message: string, values?: Record<string, unknown>) => t(message, values),
      formatLocale,
    }),
    [reactiveTranslator, formatLocale],
  );
  return { ...snapshot, locale: instance.language };
}

export function getFormatLocale(): string {
  return formatLocaleTag;
}

function updateDocumentLanguage(locale: SupportedLocale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = UI_LOCALE_REGISTRY[locale].direction;
  }
}

/** Changes only the runtime; the existing app-settings hook owns persistence. */
export function setLanguagePreference(next: LanguagePreference): void {
  const languages = resolveLanguagePreference(next) === "system" ? browserLanguages() : [];
  const locale = resolveLocale(next, languages);
  if (preference !== next || i18n.language !== locale) {
    preference = next;
    void i18n.changeLanguage(locale);
  } else {
    preference = next;
  }
  publishFormatLocale(resolveFormatLocale(next, languages));
  updateDocumentLanguage(locale);
  syncDesktopLanguage();
}

/** Install before the first render; app settings already broadcasts same-tab writes. */
export function initializeI18n(): () => void {
  setLanguagePreference(storedPreference());
  if (typeof window === "undefined") return () => {};

  const syncPreference = () => setLanguagePreference(storedPreference());
  const onLanguageChange = () => {
    if (resolveLanguagePreference(preference) !== "system") return;
    // Refresh native candidates once: preload values would otherwise stay frozen at launch.
    const languages = browserLanguages();
    const locale = resolveLocale(preference, languages);
    void i18n.changeLanguage(locale);
    publishFormatLocale(resolveFormatLocale(preference, languages));
    updateDocumentLanguage(locale);
    syncDesktopLanguage(true);
  };
  const onStorageChange = (event: StorageEvent) => {
    if (event.key === null || event.key === APP_SETTINGS_STORAGE_KEY) {
      syncPreference();
    }
  };
  const onLocalChange = (event: Event) => {
    if ((event as CustomEvent<{ key: string }>).detail?.key === APP_SETTINGS_STORAGE_KEY) {
      syncPreference();
    }
  };

  window.addEventListener("languagechange", onLanguageChange);
  window.addEventListener("storage", onStorageChange);
  window.addEventListener("synara:local_storage_change", onLocalChange);
  return () => {
    window.removeEventListener("languagechange", onLanguageChange);
    window.removeEventListener("storage", onStorageChange);
    window.removeEventListener("synara:local_storage_change", onLocalChange);
  };
}
