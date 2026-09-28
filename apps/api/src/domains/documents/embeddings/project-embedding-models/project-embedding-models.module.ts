import { Module } from "@nestjs/common"
import { DocumentChunkEmbeddingRepository } from "./document-chunk-embedding.repository"
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { ProjectEmbeddingModelProgressNotifierService } from "./project-embedding-model-progress-notifier.service"
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"
import { ProjectEmbeddingReembedBatchModule } from "./project-embedding-reembed-batch.module"

/**
 * Persistence and lifecycle of a project's local embedding models. Depends on nothing in the
 * projects or agents modules, so the agent settings module can import it without a cycle.
 * The HTTP controller and the SSE stream stay in DocumentsModule.
 */
@Module({
  imports: [ProjectEmbeddingReembedBatchModule],
  providers: [
    ProjectEmbeddingModelsService,
    ProjectEmbeddingModelRepository,
    ProjectEmbeddingModelProgressNotifierService,
    DocumentChunkEmbeddingRepository,
  ],
  exports: [
    ProjectEmbeddingModelsService,
    ProjectEmbeddingModelRepository,
    DocumentChunkEmbeddingRepository,
  ],
})
export class ProjectEmbeddingModelsModule {}
