import { randomUUID } from "node:crypto"
import { EmbeddingModel } from "@caseai-connect/api-contracts"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"

type ProjectEmbeddingModelTransientParams = RequiredScopeTransientParams

class ProjectEmbeddingModelFactory extends Factory<
  ProjectEmbeddingModel,
  ProjectEmbeddingModelTransientParams
> {
  completed() {
    return this.params({ status: "completed", totalChunks: 10, processedChunks: 10 })
  }

  failed() {
    return this.params({ status: "failed", error: "Embedding job failed" })
  }
}

export const projectEmbeddingModelFactory = ProjectEmbeddingModelFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      modelName: params.modelName ?? EmbeddingModel.BgeM3,
      status: params.status ?? "pending",
      totalChunks: params.totalChunks ?? 0,
      processedChunks: params.processedChunks ?? 0,
      error: params.error ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
    } satisfies ProjectEmbeddingModel
  },
)
