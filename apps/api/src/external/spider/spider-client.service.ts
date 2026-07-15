import { Injectable, Logger } from "@nestjs/common"
import { Spider } from "@spider-cloud/spider-client"
import { resolveSpiderApiKey } from "./spider.constants"

export type CrawledPage = {
  url: string
  markdown: string
}

const SPIDER_PARAMS = {
  limit: 0,
  return_format: "markdown" as const,
  metadata: true,
  request: "smart" as const,
  sitemap: true,
  stealth: true,
  fingerprint: true,
}

@Injectable()
export class SpiderClientService {
  private readonly logger = new Logger(SpiderClientService.name)

  async crawlUrl(params: {
    url: string
    onPage?: (page: CrawledPage) => void
  }): Promise<CrawledPage[]> {
    const apiKey = resolveSpiderApiKey()
    const spider = new Spider({ apiKey })

    this.logger.log(`Starting crawl of ${params.url} with params: ${JSON.stringify(SPIDER_PARAMS)}`)

    const pages: CrawledPage[] = []
    let skipped = 0
    const startedAt = Date.now()

    await spider.crawlUrl(params.url, SPIDER_PARAMS, true, (chunk) => {
      const items = Array.isArray(chunk) ? chunk : [chunk]
      for (const item of items) {
        if (!item?.content || item.content.trim().length === 0) {
          skipped += 1
          this.logger.warn(`Skipped empty page: ${item?.url ?? "unknown url"}`)
          continue
        }
        const page: CrawledPage = {
          url: item.url ?? params.url,
          markdown: item.content,
        }
        pages.push(page)
        this.logger.log(`Page ${pages.length}: ${page.url}`)
        params.onPage?.(page)
      }
    })

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    this.logger.log(
      `Finished crawl of ${params.url}: ${pages.length} pages, ${skipped} skipped, duration: ${durationSeconds}s`,
    )
    return pages
  }
}
