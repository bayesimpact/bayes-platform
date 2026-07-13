import type { APIRoute, GetStaticPaths } from "astro"
import { isLocale, LOCALES, type Locale } from "@/consts"
import { docHref, getDocsForLocale } from "@/lib/docs"

export const getStaticPaths = (() => {
  return LOCALES.map((lang) => ({ params: { lang } }))
}) satisfies GetStaticPaths

/** Strips Markdown/MDX syntax down to plain, searchable text. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/[*_>#-]/g, " ") // leftover markdown marks
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500)
}

export const GET: APIRoute = async ({ params }) => {
  const locale: Locale = isLocale(params.lang ?? "") ? (params.lang as Locale) : "en"
  const docs = await getDocsForLocale(locale)

  const index = docs.map((doc) => ({
    title: doc.data.title,
    description: doc.data.description,
    category: doc.data.category,
    href: docHref(doc),
    content: toPlainText(doc.body ?? ""),
  }))

  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  })
}
