import { Injectable, Logger } from "@nestjs/common"
import { Docling } from "docling-sdk"
import { chromium } from "playwright"
import {
  assertCrawlUrlIsSafe,
  assertIpIsSafe,
  UnsafeCrawlUrlError,
} from "@/common/utils/crawl-url-safety"
import { resolveDoclingServeUrl } from "./docling-crawler.constants"

export type CrawledPage = {
  url: string
  markdown: string
}

const PAGE_GOTO_TIMEOUT_MS = 30000
const MAX_CRAWL_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const SKIPPED_LINK_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif)$/i

function isUnderBasePath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath.replace(/\/$/, "")}/`)
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
    let basePath = startUrl.pathname
    const visitedUrls = new Set<string>()
    const urlQueue: string[] = [params.url]
    const pages: CrawledPage[] = []
    let skipped = 0
    let errored = 0
    const startedAt = Date.now()

    this.logger.log(`Starting Docling crawl of ${params.url} via ${doclingServeUrl}`)

    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
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
            const resolvedUrl = new URL(page.url())
            baseUrl = resolvedUrl.origin
            basePath = resolvedUrl.pathname
          }

          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a")).map((anchor) => anchor.href),
          )

          const currentPathname = new URL(currentUrl).pathname
          for (const link of links) {
            try {
              const parsedLink = new URL(link)
              const isSamePageAnchor =
                parsedLink.hash !== "" && parsedLink.pathname === currentPathname
              if (
                parsedLink.origin === baseUrl &&
                isUnderBasePath(parsedLink.pathname, basePath) &&
                !isSamePageAnchor &&
                !visitedUrls.has(parsedLink.href) &&
                !urlQueue.includes(parsedLink.href) &&
                !SKIPPED_LINK_EXTENSIONS.test(link)
              ) {
                urlQueue.push(parsedLink.href)
              }
            } catch {
              // ignore malformed links
            }
          }
          linksEnqueued = true

          // Docling's layout parser silently drops <dl>/<dt>/<dd> (definition list) content
          // during HTML->Markdown conversion, so rewrite definition lists to <ul> beforehand.
          await page.evaluate(() => {
            document.querySelectorAll("dl").forEach((dl) => {
              const ul = document.createElement("ul")
              dl.querySelectorAll("dt").forEach((dt) => {
                let dd = dt.nextElementSibling
                while (dd && dd.tagName !== "DD") dd = dd.nextElementSibling
                const li = document.createElement("li")
                const strong = document.createElement("strong")
                strong.textContent = dt.textContent ?? ""
                li.appendChild(strong)
                if (dd) li.appendChild(document.createTextNode(` — ${dd.textContent ?? ""}`))
                ul.appendChild(li)
              })
              dl.replaceWith(ul)
            })
          })

          const html = await page.content()
          const htmlBuffer = Buffer.from(html, "utf-8")
          const doclingResult = await client.convert(htmlBuffer, "page.html", {
            to_formats: ["md"],
          })
          const markdown = doclingResult.document.md_content ?? ""

          const crawledPage: CrawledPage = { url: currentUrl, markdown }
          pages.push(crawledPage)
          this.logger.log(`Page ${pages.length}: ${currentUrl}`)
          params.onPage?.(crawledPage)
        } catch (error) {
          if (
            error instanceof UnsafeCrawlUrlError ||
            isDoclingConnectionError(error) ||
            (isStartUrl && !linksEnqueued)
          ) {
            throw error
          }
          errored += 1
          this.logger.error(`Failed to crawl ${currentUrl}: ${(error as Error).message}`)
        }
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
      `Finished Docling crawl of ${params.url}: ${pages.length} pages, ${skipped} skipped, ${errored} errored, duration: ${durationSeconds}s`,
    )
    return pages
  }
}
