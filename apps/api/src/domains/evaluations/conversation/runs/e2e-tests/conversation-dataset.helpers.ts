import type { Repository } from "typeorm"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import { EvaluationConversationDataset } from "../../datasets/evaluation-conversation-dataset.entity"
import { evaluationConversationDatasetFactory } from "../../datasets/evaluation-conversation-dataset.factory"
import { EvaluationConversationDatasetRecord } from "../../datasets/records/evaluation-conversation-dataset-record.entity"
import { evaluationConversationDatasetRecordFactory } from "../../datasets/records/evaluation-conversation-dataset-record.factory"
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"
import { evaluationConversationRunFactory } from "../evaluation-conversation-run.factory"

/** Simple manual input/expectedOutput pairs (no CSV, records are created via the API). */
export const SIMPLE_CONVERSATION_RECORDS = [
  { input: "What is 1+1?", expectedOutput: "2" },
  { input: "What is 2+2?", expectedOutput: "4" },
  { input: "What color is the sky?", expectedOutput: "blue" },
]

/**
 * Creates a dataset with manually-created records.
 * Does NOT require file storage or CSV parsing — records are inserted directly.
 */
export async function createDatasetWithRecords({
  getRepository,
  organization,
  project,
}: {
  getRepository: <T extends object>(entity: new () => T) => Repository<T>
  organization: Organization
  project: Project
}) {
  const dataset = evaluationConversationDatasetFactory
    .transient({ organization, project })
    .build({ name: "Conversation Test Dataset" })
  await getRepository(EvaluationConversationDataset).save(dataset)

  const records = SIMPLE_CONVERSATION_RECORDS.map(({ input, expectedOutput }) =>
    evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input, expectedOutput }),
  )
  await getRepository(EvaluationConversationDatasetRecord).save(records)

  return { dataset, records }
}

/**
 * Creates a complete evaluation run setup: dataset with manual records + a pending run.
 */
export async function createRunWithConversationDataset({
  getRepository,
  organization,
  project,
  agent,
  agentSettings,
}: {
  getRepository: <T extends object>(entity: new () => T) => Repository<T>
  organization: Organization
  project: Project
  agent: Agent
  agentSettings: AgentSettings
}) {
  const { dataset, records: datasetRecords } = await createDatasetWithRecords({
    getRepository,
    organization,
    project,
  })

  const run = evaluationConversationRunFactory
    .transient({
      organization,
      project,
      agent,
      agentSettings,
      evaluationConversationDataset: dataset,
    })
    .build()
  await getRepository(EvaluationConversationRun).save(run)

  return { dataset, datasetRecords, run }
}
