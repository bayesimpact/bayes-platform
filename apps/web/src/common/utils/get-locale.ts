import { AgentLocale } from "@caseai-connect/api-contracts"
import { enUS, fr, type Locale } from "date-fns/locale"

/**
 * Narrows any language tag ("fr", "fr-FR", "en-GB") to the locales the app supports.
 * i18next persists the full browser tag (e.g. "fr-FR") in localStorage even though
 * `load: "languageOnly"` exposes it as "fr" through `i18n.language`.
 */
export const toAgentLocale = (language: string | null | undefined): AgentLocale =>
  language?.toLowerCase().startsWith("fr") ? AgentLocale.FR : AgentLocale.EN

/** BCP 47 tags accepted by the Web Speech API for each supported locale. */
const SPEECH_RECOGNITION_LANGUAGES: Record<AgentLocale, string> = {
  [AgentLocale.FR]: "fr-FR",
  [AgentLocale.EN]: "en-US",
}

export const getSpeechRecognitionLanguage = (language: string | null | undefined): string =>
  SPEECH_RECOGNITION_LANGUAGES[toAgentLocale(language)]

export const getLocale = (): Locale => {
  const userLang = localStorage.getItem("i18nextLng")
  return toAgentLocale(userLang) === AgentLocale.FR ? fr : enUS
}
