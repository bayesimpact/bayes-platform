import {
  type AgentModelsOutputDto,
  agentModelsOutputSchema,
  type ConversationRunOutputDto,
  type ConversationRunRecordOutputDto,
  conversationRunOutputSchema,
  conversationRunRecordOutputSchema,
} from "@caseai-connect/eval-contracts"
import type { ConversationDatasetRecord } from "./conversation-datasets.factory"
import { daysAgo } from "./review-campaigns.factory"

/** A conversation run of a project with its records, whole: the handlers page the records. */
export type ConversationRunRecord = {
  projectId: string
  run: ConversationRunOutputDto
  records: ConversationRunRecordOutputDto[]
}

/** The models of a project: two the project can use, one it cannot. */
export function buildAgentModels(): AgentModelsOutputDto {
  return agentModelsOutputSchema.parse({
    models: [
      { model: "model-large", isAvailable: true },
      { model: "model-small", isAvailable: true },
      { model: "model-legacy", isAvailable: false },
    ],
    defaults: { judge: "model-large" },
  })
}

/** A record of a run, checked against the contract. */
export function buildConversationRunRecord(
  overrides: Partial<ConversationRunRecordOutputDto> = {},
): ConversationRunRecordOutputDto {
  return conversationRunRecordOutputSchema.parse({
    id: crypto.randomUUID(),
    status: "graded",
    input: "Which plan should a team of five pick?",
    expectedOutput: "The Pro plan: it includes five seats and shared workspaces.",
    output: "A team of five fits the Pro plan, which comes with five seats.",
    score: 1,
    errorDetails: null,
    traceUrl: null,
    ...overrides,
  })
}

/** The summary of a run, from its records. */
function summaryOf(records: ConversationRunRecordOutputDto[]): ConversationRunOutputDto["summary"] {
  const graded = records.filter((record) => record.status === "graded")
  const scores = graded.flatMap((record) => (record.score === null ? [] : [record.score]))
  return {
    averageScore:
      scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length,
    errors: records.filter((record) => record.status === "error").length,
    graded: graded.length,
    running: records.filter((record) => record.status === "running").length,
    total: records.length,
  }
}

/** A run of an agent over a dataset with its records, checked against the contract. */
export function buildConversationRun(
  projectId: string,
  overrides: Partial<ConversationRunOutputDto> &
    Pick<ConversationRunOutputDto, "agentId" | "evaluationConversationDatasetId">,
  records: ConversationRunRecordOutputDto[] = [],
): ConversationRunRecord {
  const run = conversationRunOutputSchema.parse({
    id: crypto.randomUUID(),
    agentSettings: {
      instructions: "You answer questions about plans and billing, in a few sentences.",
      model: "model-large",
      revision: 2,
    },
    status: "completed",
    judgeModel: "model-large",
    judgeInstructions: null,
    summary: summaryOf(records),
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  })
  return { projectId, run, records }
}

/**
 * The runs of the main dataset by the main agent: one over, one under way and one that failed.
 * Each takes its records from the dataset's.
 */
export function buildPricingRuns(
  projectId: string,
  agentId: string,
  dataset: ConversationDatasetRecord,
): ConversationRunRecord[] {
  const ids = { agentId, evaluationConversationDatasetId: dataset.dataset.id }
  const answered = (score: number, index: number) => {
    const source = dataset.records[index]
    return buildConversationRunRecord({
      input: source?.input,
      expectedOutput: source?.expectedOutput,
      output: source?.expectedOutput,
      score,
    })
  }
  const completed = [1, 1, 0.5, 1, 0, 1, 1, 0.75, 1, 1, 1].map(answered)
  completed.push(
    buildConversationRunRecord({
      status: "error",
      input: dataset.records[11]?.input,
      expectedOutput: dataset.records[11]?.expectedOutput,
      output: null,
      score: null,
      errorDetails: "The model did not answer in time.",
    }),
  )
  const underWay = [
    ...[1, 1, 0.5].map(answered),
    ...dataset.records.slice(3, 6).map((source) =>
      buildConversationRunRecord({
        status: "running",
        input: source.input,
        expectedOutput: source.expectedOutput,
        output: null,
        score: null,
      }),
    ),
  ]
  return [
    buildConversationRun(
      projectId,
      { ...ids, status: "running", createdAt: Date.now() - 60_000, updatedAt: Date.now() },
      underWay,
    ),
    buildConversationRun(
      projectId,
      {
        ...ids,
        judgeInstructions: "Accept an answer that names the right plan, whatever its wording.",
        agentSettings: {
          instructions: "You answer questions about plans and billing, in a few sentences.",
          model: "model-large",
          revision: 3,
        },
      },
      completed,
    ),
    buildConversationRun(
      projectId,
      {
        ...ids,
        status: "failed",
        summary: null,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      [],
    ),
  ]
}
