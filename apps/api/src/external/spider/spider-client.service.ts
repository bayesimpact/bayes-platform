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

  async crawlUrl(params: { url: string }): Promise<CrawledPage[]> {
    const apiKey = resolveSpiderApiKey()
    const spider = new Spider({ apiKey })

    this.logger.log(`Crawling ${params.url} (full site, no page limit)`)

    const response = await spider.crawlUrl(params.url, {
      limit: 0,
      return_format: "markdown",
      metadata: true,
    })

    if (!response) {
      this.logger.warn(`Spider returned no response for ${params.url}`)
      return []
    }

    // Spider may return a nested array — flatten it
    const flatResponse = response.flat()

    this.logger.debug(
      `Spider flat response: ${flatResponse.length} items, keys: ${flatResponse.length > 0 && flatResponse[0] ? Object.keys(flatResponse[0]).join(", ") : "N/A"}`,
    )

    const pages = flatResponse
      .filter((page) => page.content && page.content.trim().length > 0)
      .map((page) => ({
        url: page.url ?? params.url,
        markdown: page.content ?? "",
      }))

    this.logger.log(`Crawled ${pages.length} pages from ${params.url}`)
    return pages
  }
}
