import { Injectable, Logger } from "@nestjs/common"
import { Docling } from "docling-sdk"
import { chromium } from "playwright"
import {
  assertCrawlUrlIsSafe,
  assertIpIsSafe,
  UnsafeCrawlUrlError,
} from "@/common/utils/crawl-url-safety"
import { resolveDoclingServeUrl } from "./docling-crawler.constants"
import { rewriteDefinitionListsAsUnorderedLists } from "./docling-definition-list-rewrite"

export type CrawledPage = {
  url: string
  markdown: string
}

const PAGE_GOTO_TIMEOUT_MS = 30000
const MAX_CRAWL_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const MAX_IN_FLIGHT_CONVERSIONS = 2
const SKIPPED_LINK_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif)$/i

function isUnderBasePath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath.replace(/\/$/, "")}/`)
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ""
  return parsed.href
}

function isDoclingConnectionError(error: unknown): boolean {
  const { code, cause } = error as { code?: string; cause?: { code?: string } }
  return code === "ECONNREFUSED" || cause?.code === "ECONNREFUSED"
}

@Injectable()
export class DoclingCrawlerClientService {
  private readonly logger = new Logger(DoclingCrawlerClientService.name)

  async crawlUrl(params: {
    url: string
    onPage?: (page: CrawledPage) => void
    maxCrawlDurationMs?: number
  }): Promise<CrawledPage[]> {
    const maxCrawlDurationMs = params.maxCrawlDurationMs ?? MAX_CRAWL_DURATION_MS
    const doclingServeUrl = resolveDoclingServeUrl()
    const client = new Docling({ api: { baseUrl: doclingServeUrl } })

    const startUrl = new URL(params.url)
    let baseUrl = startUrl.origin
    const basePath = startUrl.pathname
    const visitedUrls = new Set<string>()
    const urlQueue: string[] = [normalizeUrl(params.url)]
    const queuedUrls = new Set<string>(urlQueue)
    const pages: CrawledPage[] = []
    let skipped = 0
    let errored = 0
    let emptyPages = 0
    const startedAt = Date.now()

    const inFlightConversions: Array<{ url: string; promise: ReturnType<typeof client.convert> }> =
      []

    const drainOldestConversion = async (): Promise<void> => {
      const entry = inFlightConversions.shift()
      if (!entry) return

      try {
        const doclingResult = await entry.promise
        const markdown = doclingResult.document.md_content ?? ""

        if (markdown.trim().length === 0) {
          emptyPages += 1
          this.logger.warn(`Skipped ${entry.url} — empty markdown after conversion`)
          return
        }

        const crawledPage: CrawledPage = { url: entry.url, markdown }
        pages.push(crawledPage)
        this.logger.log(`Page ${pages.length}: ${entry.url}`)
        params.onPage?.(crawledPage)
      } catch (error) {
        if (isDoclingConnectionError(error)) {
          throw error
        }
        errored += 1
        this.logger.error(`Failed to convert ${entry.url}: ${(error as Error).message}`)
      }
    }

    this.logger.log(`Starting Docling crawl of ${params.url} via ${doclingServeUrl}`)

    const browser = await chromium.launch()

    try {
      const context = await browser.newContext()
      const page = await context.newPage()

      while (urlQueue.length > 0) {
        if (Date.now() - startedAt > maxCrawlDurationMs) {
          this.logger.warn(
            `Reached max crawl duration (${maxCrawlDurationMs}ms) for ${params.url} — stopping crawl early`,
          )
          break
        }

        const currentUrl = urlQueue.shift()
        if (!currentUrl || visitedUrls.has(currentUrl)) continue
        visitedUrls.add(currentUrl)

        await assertCrawlUrlIsSafe(currentUrl)

        const isStartUrl = visitedUrls.size === 1
        let linksEnqueued = false

        try {
          const response = await page.goto(currentUrl, {
            waitUntil: "load",
            timeout: PAGE_GOTO_TIMEOUT_MS,
          })

          const serverAddr = await response?.serverAddr()
          if (serverAddr) {
            assertIpIsSafe(serverAddr.ipAddress)
          }

          const statusCode = response?.status()

          if (!response || (statusCode ?? 0) >= 400) {
            if (isStartUrl) {
              throw new Error(`Start URL failed to load (HTTP ${statusCode ?? "no response"})`)
            }
            skipped += 1
            this.logger.warn(`Skipped ${currentUrl} — HTTP ${statusCode ?? "no response"}`)
            continue
          }

          if (isStartUrl) {
            baseUrl = new URL(page.url()).origin
          }

          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a")).map((anchor) => anchor.href),
          )

          for (const link of links) {
            try {
              const normalizedLink = normalizeUrl(link)
              const parsedLink = new URL(normalizedLink)
              if (
                parsedLink.origin === baseUrl &&
                isUnderBasePath(parsedLink.pathname, basePath) &&
                !visitedUrls.has(normalizedLink) &&
                !queuedUrls.has(normalizedLink) &&
                !SKIPPED_LINK_EXTENSIONS.test(parsedLink.pathname)
              ) {
                urlQueue.push(normalizedLink)
                queuedUrls.add(normalizedLink)
              }
            } catch {
              // ignore malformed links
            }
          }
          linksEnqueued = true

          await page.evaluate(rewriteDefinitionListsAsUnorderedLists)

          const html = await page.content()
          const htmlBuffer = Buffer.from(html, "utf-8")
          const conversionPromise = client.convert(htmlBuffer, "page.html", {
            to_formats: ["md"],
          })
          inFlightConversions.push({ url: currentUrl, promise: conversionPromise })
        } catch (error) {
          if (error instanceof UnsafeCrawlUrlError || (isStartUrl && !linksEnqueued)) {
            throw error
          }
          errored += 1
          this.logger.error(`Failed to crawl ${currentUrl}: ${(error as Error).message}`)
        }

        if (inFlightConversions.length >= MAX_IN_FLIGHT_CONVERSIONS) {
          await drainOldestConversion()
        }
      }

      while (inFlightConversions.length > 0) {
        await drainOldestConversion()
      }

      if (pages.length === 0 && errored > 0) {
        throw new Error(
          `Docling crawl of ${params.url} completed with ${errored} error(s) and no pages`,
        )
      }
    } finally {
      await browser.close()
    }

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    this.logger.log(
      `Finished Docling crawl of ${params.url}: ${pages.length} pages, ${skipped} skipped, ${emptyPages} empty, ${errored} errored, duration: ${durationSeconds}s`,
    )
    return pages
  }
}
