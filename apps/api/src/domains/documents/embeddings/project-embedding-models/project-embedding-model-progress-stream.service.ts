import type { ProjectEmbeddingModelProgressChangedEventDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL } from "./project-embedding-model-progress.constants"

@Injectable()
export class ProjectEmbeddingModelProgressStreamService extends PostgresStatusStreamService<ProjectEmbeddingModelProgressChangedEventDto> {
  constructor() {
    super({
      channel: PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL,
      expectedType: PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL,
      serviceName: ProjectEmbeddingModelProgressStreamService.name,
      isExpectedEvent: (payload) =>
        payload.type === PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL,
    })
  }
}
