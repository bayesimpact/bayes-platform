import type { EmbeddingModel, ProjectEmbeddingModelStatus } from "@caseai-connect/api-contracts"
import { Column } from "typeorm"
import { ConnectEntityBase, ConnectEntityWithUniqueIndex } from "@/common/entities/connect-entity"

/**
 * A local embedding model enabled on a project, with the progress of the job that embeds the
 * project's existing chunks with it. One row per (project, model). The Vertex default model has
 * no row: every project has it.
 */
@ConnectEntityWithUniqueIndex("project_embedding_model", "modelName")
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
}
