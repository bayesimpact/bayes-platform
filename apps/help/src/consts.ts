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
 * Platform brand theme. The platform picks a theme *key* (`coral` / `blue`) at build
 * time via `VITE_THEME_KEY`; each key only changes `--primary`. These values MUST
 * mirror `apps/web/src/index.css` (`.coral` / `.blue`) so the help center's walkthrough
 * animations match the platform they were opened from.
 */
const THEMES = {
  coral: { primary: "oklch(74.137% 0.13055 37.323)" },
  blue: { primary: "oklch(76.123% 0.07152 212.136)" },
} as const

export const THEME_KEY = (import.meta.env.THEME_KEY as string | undefined) ?? "coral"

const theme = THEMES[THEME_KEY as keyof typeof THEMES] ?? THEMES.coral

/**
 * Brand primary colour, injected as `--brand-primary` and consumed by the animations.
 * An explicit `BRAND_PRIMARY` env wins over the `THEME_KEY` map — this is the single
 * source of truth: infra can pass the tenant's `--primary` (from its
 * `assets/{tenant}/theme.css`) directly, with no key mapping to keep in sync.
 */
export const BRAND_PRIMARY = (import.meta.env.BRAND_PRIMARY as string | undefined) ?? theme.primary

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
