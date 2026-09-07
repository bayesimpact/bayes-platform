import { AgentLocale } from "@caseai-connect/api-contracts"

const SUPPORTED_LOCALES = Object.values(AgentLocale)

/**
 * Picks the caller's preferred UI language from an `Accept-Language` header.
 *
 * Only languages the platform itself ships are returned, so a locale we cannot
 * translate to never travels to a third party. Region subtags are dropped
 * (`fr-CA` -> `fr`): the platform has one catalogue per language.
 *
 * Returns `undefined` when the header is missing or names no supported
 * language, which lets the caller leave the choice to whoever it forwards to.
 */
export function resolveSupportedLocale(acceptLanguage: unknown): AgentLocale | undefined {
  if (typeof acceptLanguage !== "string") return undefined

  const ranked = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag = "", ...parameters] = entry.split(";")
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="))
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        quality: quality ? Number(quality.slice(2)) : 1,
      }
    })
    .filter((entry) => entry.language !== "" && Number.isFinite(entry.quality))
    // `q=0` means "not acceptable", never a fallback.
    .filter((entry) => entry.quality > 0)
    .sort((left, right) => right.quality - left.quality)

  return ranked.find((entry): entry is { language: AgentLocale; quality: number } =>
    SUPPORTED_LOCALES.includes(entry.language as AgentLocale),
  )?.language
}
