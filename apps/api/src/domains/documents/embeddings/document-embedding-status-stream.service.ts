import type { DocumentEmbeddingStatusChangedEventDto } from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL } from "./document-embedding-status.constants"

@Injectable()
export class DocumentEmbeddingStatusStreamService extends PostgresStatusStreamService<DocumentEmbeddingStatusChangedEventDto> {
  constructor() {
    super({
      channel: DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL,
      expectedType: DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL,
      serviceName: DocumentEmbeddingStatusStreamService.name,
      isExpectedEvent: (payload) => payload.type === DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL,
    })
  }
}
