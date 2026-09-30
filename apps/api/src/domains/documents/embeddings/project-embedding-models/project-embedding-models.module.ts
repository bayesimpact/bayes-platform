import { Module } from "@nestjs/common"
import { ProjectEmbeddingModelRepository } from "./project-embedding-model.repository"
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"

/**
 * Persistence and lifecycle of a project's local embedding models. Depends on nothing in the
 * projects or agents modules, so any module can import it without a cycle. The HTTP controller
 * lives in DocumentsModule, which owns the guards it reuses.
 */
@Module({
  providers: [ProjectEmbeddingModelsService, ProjectEmbeddingModelRepository],
  exports: [ProjectEmbeddingModelsService, ProjectEmbeddingModelRepository],
})
export class ProjectEmbeddingModelsModule {}
