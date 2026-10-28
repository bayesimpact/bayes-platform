import {
  DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL_DTO,
  type DocumentEmbeddingStatusChangedEventDto,
  DocumentsRoutes,
} from "@caseai-connect/api-contracts"
import { readSSEStream, type SSEStreamConfig } from "@/common/sse/sse-stream-reader"
import type { DocumentEmbeddingStatusChangedEvent } from "../documents.models"

const documentEmbeddingSSEConfig: SSEStreamConfig<
  DocumentEmbeddingStatusChangedEventDto,
  DocumentEmbeddingStatusChangedEvent
> = {
  label: "Documents",
  getStreamPath: (params) =>
    DocumentsRoutes.streamEmbeddingStatus.getPath({
      organizationId: params.organizationId,
      projectId: params.projectId,
    }),
  isExpectedEvent: (dto) => dto.type === DOCUMENT_EMBEDDING_STATUS_CHANGED_CHANNEL_DTO,
  fromDto: (dto) => ({
    documentId: dto.documentId,
    embeddingStatus: dto.embeddingStatus,
    embeddingError: dto.embeddingError ?? null,
    updatedAt: dto.updatedAt,
  }),
}

export async function streamDocumentEmbeddingStatus(params: {
  organizationId: string
  projectId: string
  signal?: AbortSignal
  onStatusChanged: (event: DocumentEmbeddingStatusChangedEvent) => void
}): Promise<void> {
  return readSSEStream({
    config: documentEmbeddingSSEConfig,
    organizationId: params.organizationId,
    projectId: params.projectId,
    signal: params.signal,
    onStatusChanged: params.onStatusChanged,
  })
}
