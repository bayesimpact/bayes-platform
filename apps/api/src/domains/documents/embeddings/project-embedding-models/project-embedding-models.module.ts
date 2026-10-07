import { Module } from "@nestjs/common"
import { DocumentChunkEmbeddingRepository } from "./document-chunk-embedding.repository"
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"
import { ProjectEmbeddingReembedBatchModule } from "./project-embedding-reembed-batch.module"

/**
 * Persistence and lifecycle of a project's local embedding models. Depends on nothing in the
 * projects or agents modules, so any module can import it without a cycle. The HTTP controller
 * lives in DocumentsModule, which owns the guards it reuses.
 */
@Module({
  imports: [ProjectEmbeddingReembedBatchModule],
  providers: [
    ProjectEmbeddingModelsService,
    ProjectEmbeddingModelRepository,
    DocumentChunkEmbeddingRepository,
  ],
  exports: [
    ProjectEmbeddingModelsService,
    ProjectEmbeddingModelRepository,
    DocumentChunkEmbeddingRepository,
  ],
})
export class ProjectEmbeddingModelsModule {}
