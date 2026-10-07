/**
 * Loads all locale files dynamically using Vite's import.meta.glob
 * Supports both feature-specific and global locale files
 */

type LocaleModule = Record<string, unknown>
type LanguageResources = Record<string, LocaleModule>

/**
 * Loads locale files and groups them by language
 * Automatically discovers all .en.json and .fr.json files
 */
export async function loadLocales(): Promise<{
  en: LanguageResources
  fr: LanguageResources
}> {
  // Load all locale files from features and root locales directory
  const commonFeatureLocales = import.meta.glob("../common/features/**/locales/*.{en,fr}.json", {
    eager: true,
  })
  const deskFeatureLocales = import.meta.glob("../desk/features/**/locales/*.{en,fr}.json", {
    eager: true,
  })
  const studioFeatureLocales = import.meta.glob("../studio/features/**/locales/*.{en,fr}.json", {
    eager: true,
  })
  const evalFeatureLocales = import.meta.glob("../eval/features/**/locales/*.{en,fr}.json", {
    eager: true,
  })
  const testerFeatureLocales = import.meta.glob("../tester/features/**/locales/*.{en,fr}.json", {
    eager: true,
  })
  const reviewerFeatureLocales = import.meta.glob(
    "../reviewer/features/**/locales/*.{en,fr}.json",
    { eager: true },
  )
  const backofficeFeatureLocales = import.meta.glob(
    "../backoffice/features/**/locales/*.{en,fr}.json",
    { eager: true },
  )
  const globalLocales = import.meta.glob("../locales/*.{en,fr}.json", { eager: true })

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

  const resources: {
    en: LanguageResources
    fr: LanguageResources
  } = {
    en: {},
    fr: {},
  }

  // Process each loaded locale file
  for (const [filePath, module] of Object.entries(allLocales)) {
    const content = (module as { default?: LocaleModule }).default || module
    const fileName = filePath.split("/").pop() || ""

    // Determine language from filename (.en.json or .fr.json)
    const language = fileName.includes(".en.json")
      ? "en"
      : fileName.includes(".fr.json")
        ? "fr"
        : null
    if (!language) continue

    // Merge the locale content into the appropriate language
    Object.assign(resources[language], content)
  }

  return resources
}
