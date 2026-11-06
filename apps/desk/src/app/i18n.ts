import { i18n } from "@lingui/core"

export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

/** The language of a person whose browser speaks none of the Desk's. */
const DEFAULT_LOCALE: Locale = "en"

const LOCALE_STORAGE_KEY = "desk.locale"

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

/** The person's pick in the user menu, else the first of the browser's languages the Desk speaks. */
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

/** The language the Desk shows, as `activateLocale` set it on Lingui's `i18n.locale`. */
export function activeLocaleOf(locale: string): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}

/** Loads a catalog and shows the Desk in its language. */
export async function activateLocale(locale: Locale): Promise<void> {
  const { messages } = await import(`../locales/${locale}.po`)
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
}

/** The person's pick in the user menu, kept for their next visit. */
export async function chooseLocale(locale: Locale): Promise<void> {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // No local storage: the pick lasts until the tab closes.
  }
  await activateLocale(locale)
}

export { i18n }
