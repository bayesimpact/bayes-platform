import type { DocumentEmbeddingStatus } from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL } from "./document-embedding-status.constants"

@Injectable()
export class DocumentEmbeddingStatusNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL)
  }

  async notifyEmbeddingStatusChanged(params: {
    documentId: string
    organizationId: string
    projectId: string
    embeddingStatus: DocumentEmbeddingStatus
    embeddingError: string | null
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL,
      documentId: params.documentId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      embeddingStatus: params.embeddingStatus,
      embeddingError: params.embeddingError,
      updatedAt: params.updatedAt,
    })
  }
}
