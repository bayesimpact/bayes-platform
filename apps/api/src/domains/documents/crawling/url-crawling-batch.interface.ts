import type { CrawlUrlJobPayload } from "./url-crawling.types"

export const URL_CRAWLING_BATCH_SERVICE = "URL_CRAWLING_BATCH_SERVICE"

export interface UrlCrawlingBatchService {
  enqueueCrawlUrl(payload: CrawlUrlJobPayload): Promise<void>
  cancelCrawlUrl(params: { documentId: string }): Promise<void>
}
