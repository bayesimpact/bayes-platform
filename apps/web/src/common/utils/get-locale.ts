import { enUS, fr, type Locale } from "date-fns/locale"

/**
 * Narrows any language tag ("fr", "fr-FR", "en-GB") to the locales the app supports.
 * i18next persists the full browser tag (e.g. "fr-FR") in localStorage even though
 * `load: "languageOnly"` exposes it as "fr" through `i18n.language`.
 */
type UiLocale = "fr" | "en"

export const toUiLocale = (language: string | null | undefined): UiLocale =>
  language?.toLowerCase().startsWith("fr") ? "fr" : "en"

/** BCP 47 tags accepted by the Web Speech API for each supported locale. */
const SPEECH_RECOGNITION_LANGUAGES: Record<UiLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
}

export const getSpeechRecognitionLanguage = (language: string | null | undefined): string =>
  SPEECH_RECOGNITION_LANGUAGES[toUiLocale(language)]

export const getLocale = (): Locale => {
  const userLang = localStorage.getItem("i18nextLng")
  return toUiLocale(userLang) === "fr" ? fr : enUS
}
