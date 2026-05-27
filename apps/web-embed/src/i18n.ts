import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import chatEn from "./chat/locales/chat.en.json"
import chatFr from "./chat/locales/chat.fr.json"

export type SupportedLocale = "en" | "fr"

/**
 * Creates an isolated i18next instance for a single embed widget.
 * Using createInstance() avoids polluting the global i18next singleton,
 * which matters when multiple widgets or the host page also use i18next.
 */
export function createEmbedI18n(locale: SupportedLocale = "en") {
  const instance = i18next.createInstance()

  // initImmediate: false makes init synchronous when resources are pre-loaded,
  // so the instance is ready before the first render.
  instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: "en",
    initImmediate: false,
    interpolation: { escapeValue: false },
    resources: {
      en: { chat: chatEn.chat },
      fr: { chat: chatFr.chat },
    },
  })

  return instance
}
