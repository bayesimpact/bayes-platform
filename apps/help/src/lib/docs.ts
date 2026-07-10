import type { CollectionEntry } from "astro:content"
import { getCollection } from "astro:content"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/consts"
import { categories } from "@/i18n/categories"

export type Doc = CollectionEntry<"docs">

/** Splits a collection entry id (`"{locale}/{...slug}"`) into its parts. */
export function parseDocId(id: string): { locale: Locale; slug: string } {
  const [maybeLocale, ...rest] = id.split("/")
  const locale = maybeLocale && isLocale(maybeLocale) ? maybeLocale : DEFAULT_LOCALE
  return { locale, slug: rest.join("/") }
}

/** Root-relative URL for an article. */
export function docHref(doc: Doc): string {
  const { locale, slug } = parseDocId(doc.id)
  return `/${locale}/${slug}`
}

/** Every non-draft article for a given locale, excluding drafts in production. */
export async function getDocsForLocale(locale: Locale): Promise<Doc[]> {
  const isDev = import.meta.env.DEV
  const all = await getCollection("docs", (doc) => {
    if (parseDocId(doc.id).locale !== locale) return false
    return isDev || !doc.data.draft
  })
  return all
}

export type CategoryGroup = {
  id: string
  order: number
  docs: Doc[]
  /** Nested sub-category groups (for a parent category). Empty for leaf groups. */
  children: CategoryGroup[]
}

const categoryOrder = (id: string) =>
  categories.find((category) => category.id === id)?.order ?? Number.MAX_SAFE_INTEGER

const categoryParentId = (id: string) => categories.find((category) => category.id === id)?.parent

/**
 * Groups locale docs into a two-level tree, ordered by the category registry then
 * each doc's `order`. Docs filed under a sub-category are nested beneath their
 * parent category, which is materialised on demand. Only categories that end up
 * with docs (directly or through a child) appear — empty/reserved ones are skipped.
 */
export function groupByCategory(docs: Doc[]): CategoryGroup[] {
  const docsByCategory = new Map<string, Doc[]>()
  for (const doc of docs) {
    const list = docsByCategory.get(doc.data.category) ?? []
    list.push(doc)
    docsByCategory.set(doc.data.category, list)
  }

  const topLevel = new Map<string, CategoryGroup>()
  const ensureTopLevel = (id: string): CategoryGroup => {
    let node = topLevel.get(id)
    if (!node) {
      node = { id, order: categoryOrder(id), docs: [], children: [] }
      topLevel.set(id, node)
    }
    return node
  }

  for (const [categoryId, list] of docsByCategory) {
    const sortedDocs = [...list].sort((a, b) => a.data.order - b.data.order)
    const parentId = categoryParentId(categoryId)
    if (parentId) {
      ensureTopLevel(parentId).children.push({
        id: categoryId,
        order: categoryOrder(categoryId),
        docs: sortedDocs,
        children: [],
      })
    } else {
      ensureTopLevel(categoryId).docs = sortedDocs
    }
  }

  const result = [...topLevel.values()]
  for (const node of result) node.children.sort((a, b) => a.order - b.order)
  return result.sort((a, b) => a.order - b.order)
}
