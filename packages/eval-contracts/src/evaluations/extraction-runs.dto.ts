import { z } from "zod"
import { projectParamsSchema } from "../common/params.dto"
import { conversationRunStatusSchema } from "./conversation-runs.dto"

/** The permissions of a project's extraction runs, which only its evaluators hold. */
export const EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION =
  "evaluation.extraction.run.create" as const
export const EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION =
  "evaluation.extraction.run.update" as const
export const EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION =
  "evaluation.extraction.run.delete" as const

/** How many records the API returns at most in one page of a run: the app reads them all. */
export const EXTRACTION_RUN_RECORDS_PAGE_SIZE = 100

/** The params of the routes under one extraction run. */
export const extractionRunParamsSchema = projectParamsSchema.extend({
  evaluationExtractionRunId: z.uuid(),
})

export type ExtractionRunParamsDto = z.output<typeof extractionRunParamsSchema>

/** Where a run stands: the statuses of every run. */
export const extractionRunStatusSchema = conversationRunStatusSchema

/**
 * How a run reads a field the agent extracts: compared with a column of the dataset (scored), or
 * only shown (fyi).
 */
export const extractionRunKeyMappingEntrySchema = z.object({
  agentOutputKey: z.string(),
  /** The dataset's column the field is compared with: empty for a field only shown. */
  datasetColumnId: z.string(),
  mode: z.enum(["scored", "fyi"]),
})

export type ExtractionRunKeyMappingEntryDto = z.output<typeof extractionRunKeyMappingEntrySchema>

/** The figures of a run: how many records match on every scored field, differ, failed or wait. */
export const extractionRunSummarySchema = z.object({
  total: z.number(),
  perfectMatches: z.number(),
  mismatches: z.number(),
  errors: z.number(),
  running: z.number(),
})

/** A run of an agent's saved version over a dataset: each field compared with its column. */
export const extractionRunOutputSchema = z.object({
  id: z.uuid(),
  evaluationExtractionDatasetId: z.uuid(),
  agentId: z.uuid(),
  /** The revision of the agent's version the run asks. */
  agentRevision: z.number(),
  keyMapping: z.array(extractionRunKeyMappingEntrySchema),
  status: extractionRunStatusSchema,
  /** None until the run started. */
  summary: extractionRunSummarySchema.nullable(),
  /** The results as a CSV file, once the run is over. */
  csvExportDocumentId: z.uuid().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ExtractionRunOutputDto = z.output<typeof extractionRunOutputSchema>

/** Where a record of a run stands. */
export const extractionRunRecordStatusSchema = z.enum([
  "match",
  "mismatch",
  "error",
  "running",
  "cancelled",
])

export type ExtractionRunRecordStatusDto = z.output<typeof extractionRunRecordStatusSchema>

/** A field of a record: what the agent extracted, what the dataset holds, and how they compare. */
export const extractionRunRecordFieldSchema = z.object({
  agentValue: z.unknown(),
  groundTruth: z.unknown(),
  status: z.enum(["match", "mismatch", "fyi"]),
})

export type ExtractionRunRecordFieldDto = z.output<typeof extractionRunRecordFieldSchema>

/** A record of a run: the row the agent got, and each field it extracted, by its key. */
export const extractionRunRecordOutputSchema = z.object({
  id: z.uuid(),
  evaluationExtractionDatasetRecordId: z.uuid(),
  status: extractionRunRecordStatusSchema,
  comparison: z.record(z.string(), extractionRunRecordFieldSchema).nullable(),
  agentRawOutput: z.record(z.string(), z.unknown()).nullable(),
  errorDetails: z.string().nullable(),
  /** The row of the dataset, with a value per column id. */
  datasetRecordData: z.record(z.string(), z.unknown()).nullable(),
  traceUrl: z.string().nullable(),
})

export type ExtractionRunRecordOutputDto = z.output<typeof extractionRunRecordOutputSchema>

/** A page of a run's records: `page` counts from 0. */
export const extractionRunRecordsQuerySchema = z.strictObject({
  page: z.coerce.number<string>().int().min(0),
  limit: z.coerce.number<string>().int().min(1).max(100),
})

export const extractionRunRecordsOutputSchema = z.object({
  records: z.array(extractionRunRecordOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

/** What creates a run: the agent and its saved version, the dataset, and how each field reads. */
export const extractionRunInputSchema = z.strictObject({
  evaluationExtractionDatasetId: z.uuid(),
  agentId: z.uuid(),
  /** A saved version of the agent; `null` takes the one in production. */
  agentSettingsRevision: z.number().int().nullable(),
  keyMapping: z.array(extractionRunKeyMappingEntrySchema).min(1),
})

export type ExtractionRunInputDto = z.input<typeof extractionRunInputSchema>

/** What starts a run: how many records of the dataset it asks, `null` for all of them. */
export const extractionRunExecuteInputSchema = z.strictObject({
  recordLimit: z.number().int().min(1).nullable(),
})
