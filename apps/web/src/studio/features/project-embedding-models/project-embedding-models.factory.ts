import { EmbeddingModel } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { ProjectEmbeddingModel } from "./project-embedding-models.models"

type ProjectEmbeddingModelTransientParams = {
  project: Project
}

class ProjectEmbeddingModelFactory extends Factory<
  ProjectEmbeddingModel,
  ProjectEmbeddingModelTransientParams
> {
  completed() {
    return this.params({ status: "completed", totalChunks: 120, processedChunks: 120 })
  }

  processing() {
    return this.params({ status: "processing", totalChunks: 120, processedChunks: 45 })
  }

  failed() {
    return this.params({
      status: "failed",
      error: "Local embeddings are not enabled on this worker",
    })
  }
}

export const projectEmbeddingModelFactory = ProjectEmbeddingModelFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build a ProjectEmbeddingModel",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      projectId: project.id,
      modelName: params.modelName ?? EmbeddingModel.BgeM3,
      status: params.status ?? "pending",
      totalChunks: params.totalChunks ?? 0,
      processedChunks: params.processedChunks ?? 0,
      error: params.error ?? null,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    } satisfies ProjectEmbeddingModel
  },
)
