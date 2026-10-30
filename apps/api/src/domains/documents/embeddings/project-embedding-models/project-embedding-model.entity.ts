import type { EmbeddingModel, ProjectEmbeddingModelStatus } from "@caseai-connect/api-contracts"
import { Column, Index } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"

/**
 * An embedding model enabled on a project, with the progress of the job that embeds the
 * project's existing chunks with it. One row per (project, model), whatever the provider: a new
 * project gets the models of `DOCUMENT_EMBEDDING_MODELS`, already completed since it has no chunk.
 */
@ConnectEntityWithUniqueIndex("project_embedding_model", "modelName")
@Index("UQ_project_embedding_model_default", ["projectId"], {
  unique: true,
  where: '"is_default" = true AND "deleted_at" IS NULL',
})
export class ProjectEmbeddingModel extends ConnectEntityBase {
  @Column({ name: "model_name", type: "varchar" })
  modelName!: EmbeddingModel

  @Column({ name: "status", type: "varchar", default: "pending" })
  status!: ProjectEmbeddingModelStatus

  @Column({ name: "total_chunks", type: "integer", default: 0 })
  totalChunks!: number

  @Column({ name: "processed_chunks", type: "integer", default: 0 })
  processedChunks!: number

  @Column({ name: "error", type: "text", nullable: true })
  error!: string | null

  /** The model new agents of the project search with. */
  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean
}
