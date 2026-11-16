// FILE: LanguageSettingsRow.tsx
// Purpose: Settings language selector, grouped with Appearance rather than New chats.
// Layer: Settings view fragment

import { type AppSettingsBinding } from "~/appSettings";
import { SettingResetButton, SettingsSelectControl } from "~/components/settings/SettingControls";
import { SettingsRow } from "~/components/settings/SettingsPanelPrimitives";
import { SelectItem } from "~/components/ui/select";
import { setLanguagePreference, useTranslation } from "~/i18n";
import {
  AVAILABLE_LANGUAGE_PREFERENCES,
  UI_LOCALES,
  UI_LOCALE_REGISTRY,
  type LanguagePreference,
} from "~/i18n/locale";

export function LanguageSettingsRow(binding: AppSettingsBinding) {
  const { settings, defaults, updateSettings } = binding;
  const { t } = useTranslation();
  const languagePreference = AVAILABLE_LANGUAGE_PREFERENCES.includes(settings.language)
    ? settings.language
    : defaults.language;

  const applyLanguage = (language: LanguagePreference) => {
    setLanguagePreference(language);
    updateSettings({ language });
  };

  return (
    <SettingsRow
      id="setting-language"
      title="common:general_languageAria"
      description="settings:chooseTheLanguageUsedByTheInterfaceSystemFollows"
      resetAction={
        settings.language !== defaults.language ? (
          <SettingResetButton
            label={t("common:language")}
            onClick={() => applyLanguage(defaults.language)}
          />
        ) : null
      }
      control={
        <SettingsSelectControl
          value={languagePreference}
          onValueChange={(language) => {
            if (AVAILABLE_LANGUAGE_PREFERENCES.includes(language as LanguagePreference)) {
              applyLanguage(language as LanguagePreference);
            }
          }}
          ariaLabel={t("common:general_languageAria")}
          triggerClassName="w-full sm:w-40"
          valueContent={
            languagePreference === "system"
              ? t("common:languageFollowSystem")
              : UI_LOCALE_REGISTRY[languagePreference].nativeName
          }
        >
          <SelectItem hideIndicator value="system">
            {t("common:languageFollowSystem")}
          </SelectItem>
          {UI_LOCALES.map((locale) => (
            <SelectItem hideIndicator key={locale} value={locale}>
              {UI_LOCALE_REGISTRY[locale].nativeName}
            </SelectItem>
          ))}
        </SettingsSelectControl>
      }
    />
  );
}
