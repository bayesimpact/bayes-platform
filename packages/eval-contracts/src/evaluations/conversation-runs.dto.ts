import { z } from "zod"
import { documentsRagModeSchema } from "../agents/agents.dto"
import { projectParamsSchema } from "../common/params.dto"
import { queryNumberSchema } from "../common/query.dto"

/** The permissions of a project's conversation runs, which only its evaluators hold. */
export {
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@bayes-platform/permissions"

/** The longest instructions a run gives its judge, in characters. */
export const CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH = 4000

/** The best score the judge gives an answer: scores go from 0 to it. */
export const CONVERSATION_RUN_MAX_SCORE = 5

/** How many records the API returns at most in one page of a run: the app reads them all. */
export const CONVERSATION_RUN_RECORDS_PAGE_SIZE = 100

/** The params of the routes under one conversation run. */
export const conversationRunParamsSchema = projectParamsSchema.extend({
  evaluationConversationRunId: z.uuid(),
})

export type ConversationRunParamsDto = z.output<typeof conversationRunParamsSchema>

/** Where a run stands: waiting, asking the agent, over, failed, or stopped by a person. */
export const conversationRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
])

export type ConversationRunStatusDto = z.output<typeof conversationRunStatusSchema>

/** The figures of a run: how many records it holds, how many are graded, and their average score. */
export const conversationRunSummarySchema = z.object({
  averageScore: z.number().nullable(),
  errors: z.number(),
  graded: z.number(),
  running: z.number(),
  total: z.number(),
})

/** A run of an agent's saved version over a dataset, graded by a judge model. */
export const conversationRunOutputSchema = z.object({
  id: z.uuid(),
  evaluationConversationDatasetId: z.uuid(),
  agentId: z.uuid(),
  /** The version of the agent the run asks, as it was when the run was created. */
  agentSettings: z.object({
    instructions: z.string(),
    model: z.string(),
    revision: z.number(),
    /** The options of the model, as the version set them: its thinking level, its temperature. */
    providerOptions: z.record(z.string(), z.unknown()),
    /** Which of the project's documents the version searches: all, none, or those of its tags. */
    documentsRagMode: documentsRagModeSchema,
  }),
  status: conversationRunStatusSchema,
  judgeModel: z.string(),
  judgeInstructions: z.string().nullable(),
  /** None until the run started. */
  summary: conversationRunSummarySchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ConversationRunOutputDto = z.output<typeof conversationRunOutputSchema>

/** Where a record of a run stands. */
export const conversationRunRecordStatusSchema = z.enum(["graded", "error", "running", "cancelled"])

export type ConversationRunRecordStatusDto = z.output<typeof conversationRunRecordStatusSchema>

/** A record of a run: what the agent got, what it should answer, what it answered, and its score. */
export const conversationRunRecordOutputSchema = z.object({
  id: z.uuid(),
  /** The record of the dataset it asks: none once that record was deleted. */
  evaluationConversationDatasetRecordId: z.uuid().nullable(),
  status: conversationRunRecordStatusSchema,
  input: z.string(),
  expectedOutput: z.string(),
  output: z.string().nullable(),
  /**
   * The fields the agent filled while it answered: none filled is `{}`, and an agent that
   * collects no form gives `null`.
   */
  formState: z.record(z.string(), z.unknown()).nullable(),
  /** A whole number from 0 to `CONVERSATION_RUN_MAX_SCORE`, once graded. */
  score: z.number().nullable(),
  errorDetails: z.string().nullable(),
  traceUrl: z.string().nullable(),
})

export type ConversationRunRecordOutputDto = z.output<typeof conversationRunRecordOutputSchema>

/** A page of a run's records: `page` counts from 0. */
export const conversationRunRecordsQuerySchema = z.strictObject({
  page: queryNumberSchema(z.number().int().min(0)),
  limit: queryNumberSchema(z.number().int().min(1).max(100)),
})

export const conversationRunRecordsOutputSchema = z.object({
  records: z.array(conversationRunRecordOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

/** What creates a run: the agent and its saved version, the dataset, and the judge. */
export const conversationRunInputSchema = z.strictObject({
  agentId: z.uuid(),
  /** A saved version of the agent; `null` takes the one in production. */
  agentSettingsRevision: z.number().int().nullable(),
  datasetId: z.uuid(),
  judgeModel: z.string().min(1),
  judgeInstructions: z
    .string()
    .trim()
    .max(CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH)
    .nullable(),
})

export type ConversationRunInputDto = z.input<typeof conversationRunInputSchema>

/** What starts a run: how many records of the dataset it asks, `null` for all of them. */
export const conversationRunExecuteInputSchema = z.strictObject({
  recordLimit: z.number().int().min(1).nullable(),
})
