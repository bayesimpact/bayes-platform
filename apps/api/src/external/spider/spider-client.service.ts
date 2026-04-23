import { Injectable, Logger } from "@nestjs/common"
import { Spider } from "@spider-cloud/spider-client"
import { resolveSpiderApiKey } from "./spider.constants"

export type CrawledPage = {
  url: string
  markdown: string
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

    this.logger.log(`Streaming full-site crawl of ${params.url}`)

    const pages: CrawledPage[] = []

    await spider.crawlUrl(
      params.url,
      { limit: 0, return_format: "markdown", metadata: true },
      true,
      (chunk) => {
        const items = Array.isArray(chunk) ? chunk : [chunk]
        for (const item of items) {
          if (!item?.content || item.content.trim().length === 0) continue
          const page: CrawledPage = {
            url: item.url ?? params.url,
            markdown: item.content,
          }
          pages.push(page)
          params.onPage?.(page)
        }
      },
    )

    this.logger.log(`Crawled ${pages.length} pages from ${params.url}`)
    return pages
  }
}
