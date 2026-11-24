import { z } from "zod"
import { projectParamsSchema } from "../common/params.dto"
import { columnFiltersSchema, queryNumberSchema } from "../common/query.dto"
import { datasetNameInputSchema } from "./datasets.dto"

/** The permissions of a project's extraction datasets, which only its evaluators hold. */
export const EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION =
  "evaluation.extraction.dataset.create" as const
export const EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION =
  "evaluation.extraction.dataset.update" as const
export const EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION =
  "evaluation.extraction.dataset.delete" as const

/** How many records of a dataset the app shows in a page: a dataset may hold thousands. */
export const EXTRACTION_DATASET_RECORDS_PAGE_SIZE = 50

/** The type of the files a dataset is built from. */
export const EXTRACTION_DATASET_FILE_MIME_TYPE = "text/csv" as const

/** The largest file a person uploads, in bytes: 40 MB. */
export const EXTRACTION_DATASET_FILE_MAX_SIZE = 40 * 1024 * 1024

/** The params of the routes under one extraction dataset. */
export const extractionDatasetParamsSchema = projectParamsSchema.extend({
  datasetId: z.uuid(),
})

export type ExtractionDatasetParamsDto = z.output<typeof extractionDatasetParamsSchema>

/** The params of the routes under one file of a project's extraction datasets. */
export const extractionDatasetFileParamsSchema = projectParamsSchema.extend({
  documentId: z.uuid(),
})

/** The params of the route that builds a dataset's records from a file. */
export const extractionDatasetSetupParamsSchema = extractionDatasetParamsSchema.extend({
  documentId: z.uuid(),
})

/** A CSV file a person uploaded, which a dataset is built from. */
export const extractionDatasetFileOutputSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ExtractionDatasetFileOutputDto = z.output<typeof extractionDatasetFileOutputSchema>

/** A file to upload: the API answers the signed URL that takes its bytes. */
export const extractionDatasetFilePresignInputSchema = z.strictObject({
  fileName: z.string().min(1),
  mimeType: z.literal(EXTRACTION_DATASET_FILE_MIME_TYPE),
  size: z.number().int().min(1),
})

export const extractionDatasetFilePresignOutputSchema = z.object({
  documentId: z.uuid(),
  uploadUrl: z.string(),
})

/** A column of a file: its name, and its first values, to tell what it holds. */
export const extractionDatasetFileColumnOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** A row shorter than the header gives no value for its last columns. */
  values: z.array(z.string().nullable()),
})

export type ExtractionDatasetFileColumnOutputDto = z.output<
  typeof extractionDatasetFileColumnOutputSchema
>

/**
 * What a column is to an evaluation: a value the agent must find (target), what the agent reads
 * (input), a value shown beside the results (reference), or nothing (ignore).
 */
export const extractionDatasetColumnRoleSchema = z.enum(["target", "input", "reference", "ignore"])

export type ExtractionDatasetColumnRoleDto = z.output<typeof extractionDatasetColumnRoleSchema>

/** A column of a dataset: the file's column, the name it takes and its role. */
export const extractionDatasetColumnSchema = z.object({
  id: z.string(),
  index: z.number(),
  originalName: z.string(),
  finalName: z.string(),
  role: extractionDatasetColumnRoleSchema,
})

export type ExtractionDatasetColumnDto = z.output<typeof extractionDatasetColumnSchema>

/** A dataset of a project: the rows an evaluation gives an extraction agent, and their columns. */
export const extractionDatasetOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  recordCount: z.number(),
  /** The columns by their id: empty until the dataset is set up. */
  schemaMapping: z.record(z.string(), extractionDatasetColumnSchema),
  updatedAt: z.number(),
})

export type ExtractionDatasetOutputDto = z.output<typeof extractionDatasetOutputSchema>

/** A record of a dataset: a row of the file, with a value per column id. */
export const extractionDatasetRecordOutputSchema = z.object({
  id: z.uuid(),
  data: z.record(z.string(), z.unknown()),
})

export type ExtractionDatasetRecordOutputDto = z.output<typeof extractionDatasetRecordOutputSchema>

/**
 * The page of a dataset's records to read: pages count from 0. The API narrows the records to
 * those whose columns hold a text, and sorts them by a column.
 */
export const extractionDatasetRecordsQuerySchema = z.strictObject({
  page: queryNumberSchema(z.number().int().min(0)),
  limit: queryNumberSchema(z.number().int().min(1).max(100)),
  /** The text each column must hold, by the column's id. */
  columnFilters: columnFiltersSchema.optional(),
  /** The id of the column the records are sorted by: the order of the file without it. */
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

/** A page of the records of a dataset: `total` counts the records the filters keep. */
export const extractionDatasetRecordsOutputSchema = z.object({
  records: z.array(extractionDatasetRecordOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

/** A column of a dataset, as the route that sets the dataset up takes it. */
const extractionDatasetColumnInputSchema = z.strictObject(extractionDatasetColumnSchema.shape)

/** What sets a dataset up: its name, and the columns of the file with their names and roles. */
export const extractionDatasetSetupInputSchema = z.strictObject({
  name: datasetNameInputSchema.shape.name,
  columns: z.array(extractionDatasetColumnInputSchema).min(1),
})

export type ExtractionDatasetSetupInputDto = z.input<typeof extractionDatasetSetupInputSchema>
