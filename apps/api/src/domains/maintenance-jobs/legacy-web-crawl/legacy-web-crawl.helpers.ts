import { LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE } from "@caseai-connect/api-contracts"

export type LegacyWebCrawlPage = { url: string; markdown: string }

/** The external id of the source a legacy web crawl became: unique per project, found again by a rerun. */
export function legacyWebCrawlExternalId(legacyDocumentId: string): string {
  return `${LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE}:${legacyDocumentId}`
}

/**
 * The pages of a legacy web crawl, stored as `[{ url, markdown }]` in the document content. Pages
 * with no text are left out: there is nothing to embed. A crawl that never ended has no pages.
 */
export function parseLegacyWebCrawlPages(content: string | null): LegacyWebCrawlPage[] {
  if (!content) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.flatMap((page: unknown) => {
    if (typeof page !== "object" || page === null) {
      return []
    }
    const { url, markdown } = page as { url?: unknown; markdown?: unknown }
    if (typeof url !== "string" || typeof markdown !== "string" || markdown.trim() === "") {
      return []
    }
    return [{ url, markdown }]
  })
}

/** The first markdown heading of the page, else its URL, as the site crawler app names pages. */
export function titleForLegacyWebCrawlPage(page: LegacyWebCrawlPage): string {
  const heading = page.markdown
    .split("\n")
    .map((line) => line.trim().match(/^#{1,6}\s+(.+)$/)?.[1])
    .find((match) => match !== undefined)
  return (heading?.trim() || page.url).slice(0, 500)
}
