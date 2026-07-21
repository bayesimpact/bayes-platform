/**
 * Site-wide constants for the Bayes Platform Help Center.
 * Keep this framework-agnostic so both `astro.config.mjs` and page code can import it.
 *
 * Per-tenant values come from build-time env vars (one build per tenant), with the
 * current "connect" values as defaults. See `.env.example`.
 */

export const SITE_URL =
  (import.meta.env.SITE_URL as string | undefined) ?? "https://help.bayesimpact.org"

export const SITE_TITLE =
  (import.meta.env.SITE_TITLE as string | undefined) ?? "Bayes Platform Help Center"

/** Tenant slug (internal use, e.g. analytics/debugging). */
export const TENANT = (import.meta.env.TENANT as string | undefined) ?? "connect"

/**
 * Brand primary colour of the walkthrough animations, injected as `--brand-primary`.
 * Mirrors the platform's theme mechanism (`apps/web/src/theme.css` → `:root{--primary}`):
 * a single colour, **purple by default so local dev is never mistaken for a tenant**,
 * overridden per tenant at build time via the `BRAND_PRIMARY` env (the tenant's
 * `--primary` from infra `assets/{tenant}/theme.css`). Keep the dev default in sync with
 * `apps/web/src/theme.css`.
 */
export const BRAND_PRIMARY =
  (import.meta.env.BRAND_PRIMARY as string | undefined) ?? "oklch(62.8% 0.2 303.9)"

/**
 * Brand logo mark colour, injected as `--brand-logo-color` for the animation logos.
 * Defaults to the brand primary so a single `BRAND_PRIMARY` themes everything; set an
 * explicit `BRAND_LOGO_COLOR` env only if the logo needs a different colour.
 */
export const BRAND_LOGO_COLOR =
  (import.meta.env.BRAND_LOGO_COLOR as string | undefined) ?? BRAND_PRIMARY

export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
