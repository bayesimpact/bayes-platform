import type { DocumentCrawlProgressChangedEventDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL } from "./document-crawl-progress.constants"

@Injectable()
export class DocumentCrawlProgressStreamService extends PostgresStatusStreamService<DocumentCrawlProgressChangedEventDto> {
  constructor() {
    super({
      channel: DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL,
      expectedType: DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL,
      serviceName: DocumentCrawlProgressStreamService.name,
      isExpectedEvent: (payload) => payload.type === DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL,
    })
  }
}
