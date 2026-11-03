import { i18n } from "@lingui/core"

export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

/** The language of a person whose browser speaks none of the app's. */
const DEFAULT_LOCALE: Locale = "en"

const LOCALE_STORAGE_KEY = "eval.locale"

function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

/** The person's pick in the user menu, else the first of the browser's languages the app speaks. */
export function detectLocale(): Locale {
  try {
    const picked = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(picked)) return picked
  } catch {
    // No local storage: the browser's languages decide.
  }
  const spoken = navigator.languages
    .map((language) => language.split("-")[0])
    .find((language) => isLocale(language))
  return isLocale(spoken) ? spoken : DEFAULT_LOCALE
}

/** Loads a catalog and shows the app in its language. */
export async function activateLocale(locale: Locale): Promise<void> {
  const { messages } = await import(`../locales/${locale}.po`)
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
}

export { i18n }
