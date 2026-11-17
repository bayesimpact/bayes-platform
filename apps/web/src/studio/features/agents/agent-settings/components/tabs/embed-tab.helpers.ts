import { toUiLocale } from "@/common/utils/get-locale"

/**
 * Origin of the public API, from the base URL of the private API. The API serves its
 * private routes under `/api` and the public chat routes under `/public`, on one origin.
 */
export function toPublicApiOrigin(privateApiUrl: string): string {
  return privateApiUrl.replace(/\/+$/, "").replace(/\/api$/, "")
}

/** Page of the help center in the language of the app, or null when no help center is set. */
export function toHelpPageUrl(
  helpCenterUrl: string | undefined,
  language: string | undefined,
  slug: string,
): string | null {
  if (!helpCenterUrl) return null
  return `${helpCenterUrl.replace(/\/+$/, "")}/${toUiLocale(language)}/${slug}`
}
