import chatEn from "./locales/en/chat.json";
import onboardingEn from "./locales/en/onboarding.json";
import workspaceEn from "./locales/en/workspace.json";
import settingsEn from "./locales/en/settings.json";
import commonEn from "./locales/en/common.json";
import computerEn from "./locales/en/computer.json";
import automationEn from "./locales/en/automation.json";
import gitEn from "./locales/en/git.json";
import chatZh from "./locales/zh-CN/chat.json";
import onboardingZh from "./locales/zh-CN/onboarding.json";
import workspaceZh from "./locales/zh-CN/workspace.json";
import settingsZh from "./locales/zh-CN/settings.json";
import commonZh from "./locales/zh-CN/common.json";
import computerZh from "./locales/zh-CN/computer.json";
import automationZh from "./locales/zh-CN/automation.json";
import gitZh from "./locales/zh-CN/git.json";

export const uiLocalizationResources = {
  en: {
    chat: chatEn,
    onboarding: onboardingEn,
    workspace: workspaceEn,
    settings: settingsEn,
    common: commonEn,
    computer: computerEn,
    automation: automationEn,
    git: gitEn,
  },
  "zh-CN": {
    chat: chatZh,
    onboarding: onboardingZh,
    workspace: workspaceZh,
    settings: settingsZh,
    common: commonZh,
    computer: computerZh,
    automation: automationZh,
    git: gitZh,
  },
} as const;
