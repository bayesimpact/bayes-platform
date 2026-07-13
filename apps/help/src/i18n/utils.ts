import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/consts"

/**
 * Extracts the locale prefix from a URL pathname (e.g. `/fr/getting-started`).
 * Falls back to the default locale when no valid prefix is present.
 */
export function getLocaleFromPath(pathname: string): Locale {
  const [, maybeLocale] = pathname.split("/")
  return maybeLocale && isLocale(maybeLocale) ? maybeLocale : DEFAULT_LOCALE
}

/** Builds an absolute (root-relative) path within a given locale. */
export function localizedPath(locale: Locale, path = ""): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "")
  return clean ? `/${locale}/${clean}` : `/${locale}`
}

/**
 * Rewrites the current pathname to the equivalent path in another locale,
 * preserving the rest of the route. Used by the language switcher.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = target
  } else {
    segments.unshift(target)
  }
  return `/${segments.join("/")}`
}

export { LOCALES, DEFAULT_LOCALE }
