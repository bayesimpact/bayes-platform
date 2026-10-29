/**
 * Loads all locale files dynamically using Vite's import.meta.glob
 * Supports both feature-specific and global locale files
 */

type LocaleModule = Record<string, unknown>
type LanguageResources = Record<string, LocaleModule>

/** UI languages of the studio. English is the fallback for any missing key. */
export const SUPPORTED_LANGUAGES = ["en", "fr", "de", "it", "es", "pl"] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * Loads locale files and groups them by language
 * Automatically discovers all .<language>.json files of SUPPORTED_LANGUAGES
 */
export async function loadLocales(): Promise<Record<SupportedLanguage, LanguageResources>> {
  // Load all locale files from features and root locales directory
  const commonFeatureLocales = import.meta.glob(
    "../common/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    {
      eager: true,
    },
  )
  const deskFeatureLocales = import.meta.glob(
    "../desk/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    {
      eager: true,
    },
  )
  const studioFeatureLocales = import.meta.glob(
    "../studio/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    {
      eager: true,
    },
  )
  const evalFeatureLocales = import.meta.glob(
    "../eval/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    {
      eager: true,
    },
  )
  const testerFeatureLocales = import.meta.glob(
    "../tester/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    {
      eager: true,
    },
  )
  const reviewerFeatureLocales = import.meta.glob(
    "../reviewer/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    { eager: true },
  )
  const backofficeFeatureLocales = import.meta.glob(
    "../backoffice/features/**/locales/*.{en,fr,de,it,es,pl}.json",
    { eager: true },
  )
  const globalLocales = import.meta.glob("../locales/*.{en,fr,de,it,es,pl}.json", { eager: true })

  const allLocales = {
    ...commonFeatureLocales,
    ...deskFeatureLocales,
    ...studioFeatureLocales,
    ...evalFeatureLocales,
    ...testerFeatureLocales,
    ...reviewerFeatureLocales,
    ...backofficeFeatureLocales,
    ...globalLocales,
  }

  const resources = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, {}]),
  ) as Record<SupportedLanguage, LanguageResources>

  // Process each loaded locale file
  for (const [filePath, module] of Object.entries(allLocales)) {
    const content = (module as { default?: LocaleModule }).default || module
    const fileName = filePath.split("/").pop() || ""

    // Determine language from the filename suffix (e.g. agent.de.json)
    const language = SUPPORTED_LANGUAGES.find((code) => fileName.endsWith(`.${code}.json`))
    if (!language) continue

    // Merge the locale content into the appropriate language
    Object.assign(resources[language], content)
  }

  return resources
}
