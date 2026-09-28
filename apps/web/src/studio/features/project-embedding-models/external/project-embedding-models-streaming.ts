import {
  PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL_DTO,
  type ProjectEmbeddingModelProgressChangedEventDto,
  ProjectEmbeddingModelsRoutes,
} from "@caseai-connect/api-contracts"
import { readSSEStream, type SSEStreamConfig } from "@/common/sse/sse-stream-reader"
import type { ProjectEmbeddingModelProgressEvent } from "../project-embedding-models.models"

const progressSSEConfig: SSEStreamConfig<
  ProjectEmbeddingModelProgressChangedEventDto,
  ProjectEmbeddingModelProgressEvent
> = {
  label: "ProjectEmbeddingModels",
  getStreamPath: (params) =>
    ProjectEmbeddingModelsRoutes.streamProgress.getPath({
      organizationId: params.organizationId,
      projectId: params.projectId,
    }),
  isExpectedEvent: (dto) => dto.type === PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL_DTO,
  fromDto: (dto) => ({
    projectEmbeddingModelId: dto.projectEmbeddingModelId,
    modelName: dto.modelName,
    status: dto.status,
    totalChunks: dto.totalChunks,
    processedChunks: dto.processedChunks,
    error: dto.error ?? null,
    updatedAt: dto.updatedAt,
  }),
}

export async function streamProjectEmbeddingModelProgress(params: {
  organizationId: string
  projectId: string
  signal?: AbortSignal
  onProgressChanged: (event: ProjectEmbeddingModelProgressEvent) => void
}): Promise<void> {
  return readSSEStream({
    config: progressSSEConfig,
    organizationId: params.organizationId,
    projectId: params.projectId,
    signal: params.signal,
    onStatusChanged: params.onProgressChanged,
  })
}
