import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
import { PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL } from "./project-embedding-model-progress.constants"

@Injectable()
export class ProjectEmbeddingModelProgressNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL)
  }

  async notifyProgressChanged(projectEmbeddingModel: ProjectEmbeddingModel): Promise<void> {
    await this.notify({
      type: PROJECT_EMBEDDING_MODEL_PROGRESS_CHANGED_CHANNEL,
      organizationId: projectEmbeddingModel.organizationId,
      projectId: projectEmbeddingModel.projectId,
      projectEmbeddingModelId: projectEmbeddingModel.id,
      modelName: projectEmbeddingModel.modelName,
      status: projectEmbeddingModel.status,
      totalChunks: projectEmbeddingModel.totalChunks,
      processedChunks: projectEmbeddingModel.processedChunks,
      error: projectEmbeddingModel.error ?? null,
      updatedAt: projectEmbeddingModel.updatedAt.getTime(),
    })
  }
}
