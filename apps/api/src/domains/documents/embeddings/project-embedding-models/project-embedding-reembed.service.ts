import { Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EmbedderService } from "../embedders/embedder.service"
import { getEmbedderBatchSize } from "../embedders/embedders.config"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentChunkEmbeddingRepository } from "./document-chunk-embedding.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"
import type { ReembedProjectChunksJobPayload } from "./project-embedding-reembed.types"

/**
 * Embeds every retrievable chunk of a project with a local model. Idempotent and resumable: it
 * only touches chunks with no row for the model and inserts with conflict skipping, so a retry
 * after a crash, or a document job running at the same time, never duplicates work.
 */
@Injectable()
export class ProjectEmbeddingReembedService {
  private readonly logger = new Logger(ProjectEmbeddingReembedService.name)

  constructor(
    private readonly projectEmbeddingModelsService: ProjectEmbeddingModelsService,
    private readonly chunkEmbeddingRepository: DocumentChunkEmbeddingRepository,
    private readonly embedderService: EmbedderService,
  ) {}

  async reembedProjectChunks(payload: ReembedProjectChunksJobPayload): Promise<void> {
    const { projectEmbeddingModelId, projectId, modelName } = payload
    const row = await this.projectEmbeddingModelsService.findById(projectEmbeddingModelId)
    if (!row) {
      this.logger.warn(`Project embedding model ${projectEmbeddingModelId} no longer exists`)
      return
    }

    try {
      this.embedderService.assertAvailable(modelName)

      const totalChunks = await this.chunkEmbeddingRepository.countEligibleChunks(projectId)
      let processedChunks = totalChunks - (await this.countMissing(projectId, modelName))
      await this.projectEmbeddingModelsService.markProcessing({
        id: row.id,
        totalChunks,
        processedChunks,
      })
      this.logger.log(
        `Re-embedding project ${projectId} with ${modelName}: ${processedChunks}/${totalChunks} chunks already done`,
      )

      const batchSize = getEmbedderBatchSize()
      while (true) {
        const chunks = await this.chunkEmbeddingRepository.findChunksMissingEmbedding({
          projectId,
          modelName,
          limit: batchSize,
        })
        if (chunks.length === 0) break

        const vectors = await this.embedderService.embedDocuments({
          modelName,
          texts: chunks.map((chunk) => chunk.embedText),
        })
        const insertedCount = await this.chunkEmbeddingRepository.insertEmbeddingsIgnoringConflicts(
          chunks.map((chunk, index) => ({
            organizationId: chunk.organizationId,
            projectId: chunk.projectId,
            chunkId: chunk.id,
            modelName,
            embedding: vectors[index] ?? [],
          })),
        )
        processedChunks += insertedCount
        await this.projectEmbeddingModelsService.updateProgress({
          id: row.id,
          processedChunks: Math.min(processedChunks, totalChunks),
        })
      }

      const finalTotal = await this.chunkEmbeddingRepository.countEligibleChunks(projectId)
      const finalProcessed = finalTotal - (await this.countMissing(projectId, modelName))
      await this.projectEmbeddingModelsService.markCompleted({
        id: row.id,
        totalChunks: finalTotal,
        processedChunks: finalProcessed,
      })
      this.logger.log(`Re-embedding of project ${projectId} with ${modelName} completed`)
    } catch (error) {
      // BullMQ retries the job; enabling the model again also re-queues it once the job is gone.
      await this.projectEmbeddingModelsService.markFailed({ id: row.id, error })
      throw error
    }
  }

  private countMissing(projectId: string, modelName: string): Promise<number> {
    return this.chunkEmbeddingRepository.countChunksMissingEmbedding({ projectId, modelName })
  }
}
