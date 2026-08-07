import type { CrawlUrlDoclingJobPayload } from "./docling-crawling.types"

export const DOCLING_CRAWLING_BATCH_SERVICE = "DOCLING_CRAWLING_BATCH_SERVICE"

export interface DoclingCrawlingBatchService {
  enqueueCrawlUrl(payload: CrawlUrlDoclingJobPayload): Promise<void>
  cancelCrawlUrl(params: { documentId: string }): Promise<void>
}
