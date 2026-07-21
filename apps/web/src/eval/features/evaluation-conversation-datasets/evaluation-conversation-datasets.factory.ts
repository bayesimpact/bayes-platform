import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type {
  EvaluationConversationDataset,
  EvaluationConversationDatasetRecord,
} from "./evaluation-conversation-datasets.models"

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

type EvaluationConversationDatasetRecordTransientParams = {
  dataset: EvaluationConversationDataset
}

class EvaluationConversationDatasetRecordFactory extends Factory<
  EvaluationConversationDatasetRecord,
  EvaluationConversationDatasetRecordTransientParams
> {}

export const evaluationConversationDatasetRecordFactory =
  EvaluationConversationDatasetRecordFactory.define(({ params, transientParams }) => {
    const { dataset } = transientParams
    if (!dataset) {
      throw new Error(
        "Dataset must be provided in transient params to build an EvaluationConversationDatasetRecord",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      input: params.input ?? faker.lorem.sentence(),
      expectedOutput: params.expectedOutput ?? faker.lorem.sentence(),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  })
