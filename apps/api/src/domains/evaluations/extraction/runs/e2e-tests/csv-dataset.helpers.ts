import type { EvaluationExtractionDatasetSchemaColumnDto } from "@caseai-connect/api-contracts"
import type { Repository } from "typeorm"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { EvaluationExtractionDatasetSchemaMapping } from "../../datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDataset } from "../../datasets/evaluation-extraction-dataset.entity"
import { evaluationExtractionDatasetFactory } from "../../datasets/evaluation-extraction-dataset.factory"
import { EvaluationExtractionDatasetRecord } from "../../datasets/records/evaluation-extraction-dataset-record.entity"
import { evaluationExtractionDatasetRecordFactory } from "../../datasets/records/evaluation-extraction-dataset-record.factory"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"
import { evaluationExtractionRunFactory } from "../evaluation-extraction-run.factory"

/**
 * Simple 2-column CSV: one "input" column and one "target" column.
 *
 * CSV content:
 * ```
 * question,answer
 * What is 1+1?,2
 * What is 2+2?,4
 * What color is the sky?,blue
 * ```
 */
export const SIMPLE_CSV_CONTENT =
  "question,answer\nWhat is 1+1?,2\nWhat is 2+2?,4\nWhat color is the sky?,blue"

export const SIMPLE_CSV_COLUMNS: EvaluationExtractionDatasetSchemaColumnDto[] = [
  { id: "col-question", finalName: "question", originalName: "question", index: 0, role: "input" },
  { id: "col-answer", finalName: "answer", originalName: "answer", index: 1, role: "target" },
]

export const SIMPLE_CSV_SCHEMA_MAPPING: EvaluationExtractionDatasetSchemaMapping = {
  "col-question": {
    id: "col-question",
    finalName: "question",
    originalName: "question",
    index: 0,
    role: "input",
  },
  "col-answer": {
    id: "col-answer",
    finalName: "answer",
    originalName: "answer",
    index: 1,
    role: "target",
  },
}

export const SIMPLE_CSV_ROWS = [
  { "col-question": "What is 1+1?", "col-answer": "2" },
  { "col-question": "What is 2+2?", "col-answer": "4" },
  { "col-question": "What color is the sky?", "col-answer": "blue" },
]

/**
 * Creates a dataset with records from the simple 2-column CSV.
 * Does NOT require file storage mocking — records are inserted directly.
 */
export async function createDatasetWithCsvRecords({
  getRepository,
  organization,
  project,
}: {
  getRepository: <T extends object>(entity: new () => T) => Repository<T>
  organization: Organization
  project: Project
}) {
  const dataset = evaluationExtractionDatasetFactory
    .transient({ organization, project })
    .build({ name: "CSV Test Dataset", schemaMapping: SIMPLE_CSV_SCHEMA_MAPPING })
  await getRepository(EvaluationExtractionDataset).save(dataset)

  const records = SIMPLE_CSV_ROWS.map((data) =>
    evaluationExtractionDatasetRecordFactory
      .transient({ organization, project, evaluationExtractionDataset: dataset })
      .build({ data }),
  )
  await getRepository(EvaluationExtractionDatasetRecord).save(records)

  return { dataset, records }
}

/**
 * Creates a complete evaluation run setup: dataset with CSV records + a pending run with key mapping.
 */
export async function createRunWithCsvDataset({
  getRepository,
  organization,
  project,
  agent,
  agentSettings,
  keyMapping,
}: {
  getRepository: <T extends object>(entity: new () => T) => Repository<T>
  organization: Organization
  project: Project
  agent: Agent
  agentSettings: AgentSettings
  keyMapping: EvaluationExtractionRun["keyMapping"]
}) {
  const { dataset, records: datasetRecords } = await createDatasetWithCsvRecords({
    getRepository,
    organization,
    project,
  })

  const run = evaluationExtractionRunFactory
    .transient({
      organization,
      project,
      agent,
      agentSettings,
      evaluationExtractionDataset: dataset,
    })
    .build({ keyMapping })
  await getRepository(EvaluationExtractionRun).save(run)

  return { dataset, datasetRecords, run }
}
