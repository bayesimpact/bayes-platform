import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { EvaluationConversationDataset } from "./evaluation-conversation-datasets.models"

type EvaluationConversationDatasetTransientParams = {
  project: Project
}

class EvaluationConversationDatasetFactory extends Factory<
  EvaluationConversationDataset,
  EvaluationConversationDatasetTransientParams
> {}

export const evaluationConversationDatasetFactory = EvaluationConversationDatasetFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build an EvaluationConversationDataset",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      name: params.name ?? faker.commerce.productName(),
      projectId: project.id,
      recordCount: params.recordCount ?? faker.number.int({ min: 0, max: 50 }),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
