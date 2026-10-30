import type { EmbeddingModel } from "@caseai-connect/api-contracts"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"

type ScopeParams = {
  organizationId: string
  projectId: string
}

export interface IProjectEmbeddingModelsSpi {
  getAll(params: ScopeParams): Promise<ProjectEmbeddingModel[]>
  /** Enables a model on the project and starts embedding its documents with it. */
  createOne(params: ScopeParams & { modelName: EmbeddingModel }): Promise<ProjectEmbeddingModel>
  /** Makes a completed model the one new agents of the project search with. */
  updateOne(
    params: ScopeParams & { projectEmbeddingModelId: string; isDefault: true },
  ): Promise<ProjectEmbeddingModel>
}
