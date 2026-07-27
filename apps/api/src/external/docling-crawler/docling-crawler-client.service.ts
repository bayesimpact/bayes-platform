import { Injectable, Logger } from "@nestjs/common"
import { Docling } from "docling-sdk"
import { chromium } from "playwright"
import { resolveDoclingServeUrl } from "./docling-crawler.constants"

export type CrawledPage = {
  url: string
  markdown: string
}

const PAGE_GOTO_TIMEOUT_MS = 30000
const SKIPPED_LINK_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif)$/i

@Injectable()
export class DoclingCrawlerClientService {
  private readonly logger = new Logger(DoclingCrawlerClientService.name)

  async crawlUrl(params: {
    url: string
    onPage?: (page: CrawledPage) => void
  }): Promise<CrawledPage[]> {
    const doclingServeUrl = resolveDoclingServeUrl()
    const client = new Docling({ api: { baseUrl: doclingServeUrl } })

    let baseUrl = new URL(params.url).origin
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
        const currentUrl = urlQueue.shift()
        if (!currentUrl || visitedUrls.has(currentUrl)) continue
        visitedUrls.add(currentUrl)

        try {
          const response = await page.goto(currentUrl, {
            waitUntil: "load",
            timeout: PAGE_GOTO_TIMEOUT_MS,
          })
          const statusCode = response?.status()

          if (!response || (statusCode ?? 0) >= 400) {
            skipped += 1
            this.logger.warn(`Skipped ${currentUrl} — HTTP ${statusCode ?? "no response"}`)
            continue
          }

          if (visitedUrls.size === 1) {
            baseUrl = new URL(page.url()).origin
          }

          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a")).map((anchor) => anchor.href),
          )

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

          const currentPathname = new URL(currentUrl).pathname
          for (const link of links) {
            try {
              const parsedLink = new URL(link)
              const isSamePageAnchor =
                parsedLink.hash !== "" && parsedLink.pathname === currentPathname
              if (
                parsedLink.origin === baseUrl &&
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
        } catch (error) {
          errored += 1
          this.logger.error(`Failed to crawl ${currentUrl}: ${(error as Error).message}`)
        }
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
