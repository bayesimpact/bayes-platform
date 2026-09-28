import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetSchemaColumn,
} from "./evaluation-extraction-datasets.models"

export const evaluationExtractionDatasetSchemaColumnFactory =
  Factory.define<EvaluationExtractionDatasetSchemaColumn>(({ params, sequence }) => {
    const originalName = params.originalName ?? `column_${sequence}`
    return {
      id: params.id ?? faker.string.uuid(),
      finalName: params.finalName ?? originalName,
      originalName,
      index: params.index ?? sequence,
      role: params.role ?? "target",
    }
  })

function buildDefaultSchemaMapping(): Record<string, EvaluationExtractionDatasetSchemaColumn> {
  const columns = [
    evaluationExtractionDatasetSchemaColumnFactory.build({
      finalName: "title",
      originalName: "title",
      index: 0,
      role: "target",
    }),
    evaluationExtractionDatasetSchemaColumnFactory.build({
      finalName: "summary",
      originalName: "summary",
      index: 1,
      role: "target",
    }),
    evaluationExtractionDatasetSchemaColumnFactory.build({
      finalName: "source",
      originalName: "source",
      index: 2,
      role: "input",
    }),
  ]
  return Object.fromEntries(columns.map((column) => [column.id, column]))
}

type EvaluationExtractionDatasetTransientParams = {
  project: Project
}

class EvaluationExtractionDatasetFactory extends Factory<
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetTransientParams
> {}

export const evaluationExtractionDatasetFactory = EvaluationExtractionDatasetFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error(
        "Project must be provided in transient params to build an EvaluationExtractionDataset",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      name: params.name ?? faker.commerce.productName(),
      projectId: project.id,
      documentId: params.documentId ?? null,
      recordCount: params.recordCount ?? faker.number.int({ min: 1, max: 50 }),
      schemaMapping:
        (params.schemaMapping as
          | Record<string, EvaluationExtractionDatasetSchemaColumn>
          | undefined) ?? buildDefaultSchemaMapping(),
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
