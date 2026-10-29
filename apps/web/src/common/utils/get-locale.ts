import { AgentLocale } from "@caseai-connect/api-contracts"
import { de, enUS, es, fr, it, type Locale, pl } from "date-fns/locale"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/locales/loader"

/**
 * Narrows any language tag ("de", "de-DE", "en-GB") to a supported UI language, English otherwise.
 * i18next persists the full browser tag (e.g. "fr-FR") in localStorage even though
 * `load: "languageOnly"` exposes it as "fr" through `i18n.language`.
 */
export const toUiLanguage = (language: string | null | undefined): SupportedLanguage => {
  const code = language?.toLowerCase().split("-")[0]
  return SUPPORTED_LANGUAGES.find((supported) => supported === code) ?? "en"
}

/**
 * Language a new agent answers in. Agents only speak English or French for now, so any other UI
 * language starts the agent in English.
 */
export const toAgentLocale = (language: string | null | undefined): AgentLocale =>
  toUiLanguage(language) === "fr" ? AgentLocale.FR : AgentLocale.EN

/** BCP 47 tags accepted by the Web Speech API for each UI language. */
const SPEECH_RECOGNITION_LANGUAGES: Record<SupportedLanguage, string> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
  pl: "pl-PL",
}

export const getSpeechRecognitionLanguage = (language: string | null | undefined): string =>
  SPEECH_RECOGNITION_LANGUAGES[toUiLanguage(language)]

const DATE_FNS_LOCALES: Record<SupportedLanguage, Locale> = { en: enUS, fr, de, it, es, pl }

export const getLocale = (): Locale =>
  DATE_FNS_LOCALES[toUiLanguage(localStorage.getItem("i18nextLng"))]
