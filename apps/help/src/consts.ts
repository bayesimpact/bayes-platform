/**
 * Site-wide constants for the Bayes Platform Help Center.
 * Keep this framework-agnostic so both `astro.config.mjs` and page code can import it.
 */

/** Fallback only: the deploy job sets `PUBLIC_SITE_URL` per tenant (see `astro.config.ts`). */
export const SITE_URL = "https://help.bayesimpact.org"

/** Placeholder shown in the public API reference when `PUBLIC_API_BASE_URL` is not set at build time. */
export const API_BASE_URL_PLACEHOLDER = "https://<your-api-host>"

export const SITE_TITLE = "Bayes Platform Help Center"

export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
