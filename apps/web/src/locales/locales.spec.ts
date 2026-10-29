import { describe, expect, it } from "vitest"
import { SUPPORTED_LANGUAGES } from "./loader"

/**
 * Checks every translation against its English source file: same keys, the plural forms the
 * language needs, the same {{placeholders}} and tags, and no empty strings.
 */

type LocaleTree = { [key: string]: string | LocaleTree }

const localeFiles = import.meta.glob<LocaleTree>("../**/locales/*.json", {
  eager: true,
  import: "default",
})

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(tree: LocaleTree, prefix = ""): Map<string, string> {
  const leaves = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") leaves.set(path, value)
    else for (const [leafPath, leaf] of flatten(value, path)) leaves.set(leafPath, leaf)
  }
  return leaves
}

/** Plural categories the language uses for counts up to 200 (forms only reached by millions are optional). */
function requiredPluralCategories(language: string): Set<string> {
  const rules = new Intl.PluralRules(language)
  const categories = new Set<string>()
  for (let count = 0; count <= 200; count++) categories.add(rules.select(count))
  return categories
}

const tokens = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match[0]).sort()
const placeholders = (text: string) => tokens(text, /\{\{[^}]+\}\}/g)
const tags = (text: string) => tokens(text, /<\/?[a-zA-Z0-9]+>/g)

const sourceFiles = Object.keys(localeFiles).filter((path) => path.endsWith(".en.json"))
const translations = SUPPORTED_LANGUAGES.filter((language) => language !== "en").flatMap(
  (language) =>
    sourceFiles
      .map((sourcePath) => ({
        language,
        sourcePath,
        targetPath: sourcePath.replace(/\.en\.json$/, `.${language}.json`),
      }))
      .map((entry) => ({ ...entry, name: entry.targetPath.split("/").pop() }))
      .filter(({ targetPath }) => targetPath in localeFiles),
)

describe.each(translations)("$name", ({ language, sourcePath, targetPath }) => {
  const source = flatten(localeFiles[sourcePath] as LocaleTree)
  const target = flatten(localeFiles[targetPath] as LocaleTree)
  const pluralBases = new Set(
    [...source.keys()]
      .filter((key) => PLURAL_SUFFIX.test(key))
      .map((key) => key.replace(PLURAL_SUFFIX, "")),
  )
  const isPlural = (key: string) =>
    PLURAL_SUFFIX.test(key) && pluralBases.has(key.replace(PLURAL_SUFFIX, ""))
  const sourceText = (key: string) =>
    source.get(key) ?? source.get(`${key.replace(PLURAL_SUFFIX, "")}_other`) ?? ""

  it("has the same keys as English", () => {
    const sourceKeys = [...source.keys()].filter((key) => !isPlural(key)).sort()
    const targetKeys = [...target.keys()].filter((key) => !isPlural(key)).sort()
    expect(targetKeys).toEqual(sourceKeys)
  })

  it(`has the plural forms ${language} needs`, () => {
    const missing = [...pluralBases].flatMap((base) =>
      [...requiredPluralCategories(language)]
        .map((category) => `${base}_${category}`)
        .filter((key) => !target.has(key)),
    )
    expect(missing).toEqual([])
  })

  it("keeps placeholders and tags, with no empty string", () => {
    const problems = [...target.entries()].flatMap(([key, text]) => {
      const original = sourceText(key)
      const issues: string[] = []
      if (!text.trim()) issues.push(`${key}: empty`)
      if (placeholders(text).join() !== placeholders(original).join())
        issues.push(
          `${key}: placeholders ${placeholders(text)} instead of ${placeholders(original)}`,
        )
      if (tags(text).join() !== tags(original).join()) issues.push(`${key}: tags differ`)
      return issues
    })
    expect(problems).toEqual([])
  })
})
