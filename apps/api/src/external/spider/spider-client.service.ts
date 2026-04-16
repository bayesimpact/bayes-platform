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

  async crawlUrl(params: { url: string; limit: number }): Promise<CrawledPage[]> {
    const apiKey = resolveSpiderApiKey()
    const spider = new Spider({ apiKey })

    this.logger.log(`Crawling ${params.url} with limit ${params.limit}`)

    const response = await spider.crawlUrl(params.url, {
      limit: params.limit,
      return_format: "markdown",
      metadata: true,
    })

    if (!response) {
      this.logger.warn(`Spider returned no response for ${params.url}`)
      return []
    }

    const pages = response
      .filter((page) => page.content && page.content.trim().length > 0)
      .map((page) => ({
        url: page.url ?? params.url,
        markdown: page.content ?? "",
      }))

    this.logger.log(`Crawled ${pages.length} pages from ${params.url}`)
    return pages
  }
}
