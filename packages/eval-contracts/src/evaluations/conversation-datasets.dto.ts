import { z } from "zod"
import { projectParamsSchema } from "../common/params.dto"
import { queryNumberSchema } from "../common/query.dto"

/** The permissions of a project's conversation datasets, which only its evaluators hold. */
export {
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@bayes-platform/permissions"

/** The longest input, and the longest expected output, of a record, in characters. */
export const CONVERSATION_DATASET_RECORD_MAX_LENGTH = 10_000

/** How many records the API returns at most in one page of a dataset: the app reads them all. */
export const CONVERSATION_DATASET_RECORDS_PAGE_SIZE = 100

/** The params of the routes under one conversation dataset. */
export const conversationDatasetParamsSchema = projectParamsSchema.extend({
  datasetId: z.uuid(),
})

export type ConversationDatasetParamsDto = z.output<typeof conversationDatasetParamsSchema>

/** The params of the routes under one record of a dataset. */
export const conversationDatasetRecordParamsSchema = conversationDatasetParamsSchema.extend({
  recordId: z.uuid(),
})

/** A dataset of a project: the questions an evaluation asks a conversation agent. */
export const conversationDatasetOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  recordCount: z.number(),
  updatedAt: z.number(),
})

export type ConversationDatasetOutputDto = z.output<typeof conversationDatasetOutputSchema>

/** A record of a dataset: what to ask the agent, and the answer expected of it. */
export const conversationDatasetRecordOutputSchema = z.object({
  id: z.uuid(),
  input: z.string(),
  expectedOutput: z.string(),
  /** Why the expected output is the reference, for a record saved from an agent's answer. */
  comment: z.string().nullable(),
})

export type ConversationDatasetRecordOutputDto = z.output<
  typeof conversationDatasetRecordOutputSchema
>

/** The page of a dataset's records to read: pages count from 0. */
export const conversationDatasetRecordsQuerySchema = z.strictObject({
  page: queryNumberSchema(z.number().int().min(0)),
  limit: queryNumberSchema(z.number().int().min(1).max(100)),
})

/** A page of the records of a dataset, in the order they were added. */
export const conversationDatasetRecordsOutputSchema = z.object({
  records: z.array(conversationDatasetRecordOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ConversationDatasetRecordsOutputDto = z.output<
  typeof conversationDatasetRecordsOutputSchema
>

/** A record to add to a dataset, or what a record becomes. */
export const conversationDatasetRecordInputSchema = z.strictObject({
  input: z.string().trim().min(1).max(CONVERSATION_DATASET_RECORD_MAX_LENGTH),
  expectedOutput: z.string().trim().min(1).max(CONVERSATION_DATASET_RECORD_MAX_LENGTH),
})

export type ConversationDatasetRecordInputDto = z.input<typeof conversationDatasetRecordInputSchema>

/** Several records to add to a dataset at once. */
export const conversationDatasetRecordsInputSchema = z.strictObject({
  records: z.array(conversationDatasetRecordInputSchema).min(1),
})
