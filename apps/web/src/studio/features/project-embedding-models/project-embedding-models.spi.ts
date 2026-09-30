import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"

type ScopeParams = {
  organizationId: string
  projectId: string
}

export interface IProjectEmbeddingModelsSpi {
  getAll(params: ScopeParams): Promise<ProjectEmbeddingModel[]>
  /** Enables a local model on the project and starts re-embedding its documents. */
  createOne(params: ScopeParams & { modelName: EmbeddingModel }): Promise<ProjectEmbeddingModel>
}
