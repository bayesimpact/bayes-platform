/**
 * Site-wide constants for the Bayes Platform Help Center.
 * Keep this framework-agnostic so both `astro.config.mjs` and page code can import it.
 */

export const SITE_URL = "https://help.bayesimpact.org"

export const SITE_TITLE = "Bayes Platform Help Center"

export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
