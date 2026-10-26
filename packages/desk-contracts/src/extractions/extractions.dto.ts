import { z } from "zod"
import { agentParamsSchema } from "../common/params.dto"

/** The params of the routes under one extraction of a document. */
export const extractionRunParamsSchema = agentParamsSchema.extend({ agentSessionId: z.uuid() })

/** The params of the routes under one document the person uploaded for an extraction. */
export const extractionDocumentParamsSchema = agentParamsSchema.extend({ documentId: z.uuid() })

export const extractionRunStatusSchema = z.enum(["pending", "success", "failed"])

export type ExtractionRunStatusDto = z.output<typeof extractionRunStatusSchema>

/**
 * An extraction of one document, with what the agent read in it. The API sends the file name in
 * the list only: here, it is always `null`.
 */
export const extractionRunDetailOutputSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  status: extractionRunStatusSchema,
  /** The fields of the agent's schema, as the agent filled them in; `null` until it succeeds. */
  result: z.record(z.string(), z.unknown()).nullable(),
  /** Why the extraction failed, such as `PDF_PAGE_LIMIT_EXCEEDED`. */
  errorCode: z.string().nullable(),
  errorDetails: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ExtractionRunDetailOutputDto = z.output<typeof extractionRunDetailOutputSchema>

/** Starts the extraction of a document the person uploaded. */
export const executeExtractionInputSchema = z.strictObject({
  documentId: z.uuid(),
})

export const executeExtractionOutputSchema = z.object({
  runId: z.uuid(),
})

/** The files an extraction agent reads, as its run handles them; a CSV file runs row by row. */
export const EXTRACTION_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const

/** The largest file a person can give an extraction agent, as apps/web allows it. */
export const EXTRACTION_MAX_BYTES = 25 * 1024 * 1024

/** The file to upload for an extraction, before its upload. */
export const presignExtractionDocumentInputSchema = z.strictObject({
  file: z.strictObject({
    fileName: z.string().min(1),
    mimeType: z.enum(EXTRACTION_MIME_TYPES),
    size: z.number().int().positive().max(EXTRACTION_MAX_BYTES),
  }),
})

/** Where to upload the file: a signed URL that takes a PUT of its bytes. */
export const presignExtractionDocumentOutputSchema = z.object({
  documentId: z.uuid(),
  uploadUrl: z.url(),
})

export const confirmExtractionDocumentInputSchema = z.strictObject({
  documentId: z.uuid(),
})

/** A document the person uploaded for an extraction. */
export const extractionDocumentOutputSchema = z.object({
  id: z.uuid(),
  /** The API leaves the name out of a document it has no name for. */
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  /** The language the API detected in the document. */
  language: z.enum(["en", "fr"]),
  /** The text read in the document, as Markdown; `null` until an extraction reads it. */
  content: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type ExtractionDocumentOutputDto = z.output<typeof extractionDocumentOutputSchema>

/** The answer of a deletion. */
export const deletionOutputSchema = z.object({ success: z.boolean() })

// CSV files: every row runs through the agent.

/** The params of the routes under one extraction of a CSV file. */
export const csvExtractionRunParamsSchema = agentParamsSchema.extend({
  agentCsvExtractionRunId: z.uuid(),
})

/**
 * What the agent does with a column: reads it (`input`), keeps it beside its answers in the
 * results (`reference`), or leaves it out (`ignore`).
 */
export const CSV_COLUMN_ROLES = ["input", "reference", "ignore"] as const

export const csvColumnRoleSchema = z.enum(CSV_COLUMN_ROLES)

export type CsvColumnRoleDto = z.output<typeof csvColumnRoleSchema>

/** A column of the CSV file, with its role in the extraction. */
export const csvColumnSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  finalName: z.string(),
  role: csvColumnRoleSchema,
  index: z.number(),
})

export type CsvColumnDto = z.output<typeof csvColumnSchema>

export const csvExtractionRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
])

export type CsvExtractionRunStatusDto = z.output<typeof csvExtractionRunStatusSchema>

/** How far a run went: its rows, those done, those that failed and those still running. */
export const csvExtractionRunSummarySchema = z.object({
  total: z.number(),
  processed: z.number(),
  errors: z.number(),
  running: z.number(),
})

/** An extraction of every row of a CSV file by an extraction agent, newest first in a list. */
export const csvExtractionRunDetailOutputSchema = z.object({
  id: z.uuid(),
  csvDocumentId: z.uuid(),
  /** The columns of the file, by their id. */
  columnSchema: z.record(z.string(), csvColumnSchema),
  status: csvExtractionRunStatusSchema,
  /** `null` until the run starts. */
  summary: csvExtractionRunSummarySchema.nullable(),
  /** The CSV file of the results, once the run ended. */
  csvExportDocumentId: z.uuid().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type CsvExtractionRunDetailOutputDto = z.output<typeof csvExtractionRunDetailOutputSchema>

/** A column of an uploaded CSV file, with its first values. */
export const csvFileColumnOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.unknown()),
})

export type CsvFileColumnOutputDto = z.output<typeof csvFileColumnOutputSchema>

export const createCsvExtractionRunInputSchema = z.strictObject({
  csvDocumentId: z.uuid(),
  columnSchema: z.record(z.string(), csvColumnSchema),
})

export type CreateCsvExtractionRunInputDto = z.input<typeof createCsvExtractionRunInputSchema>

/** Starts a run: on every row, or on the first ones only. */
export const executeCsvExtractionRunInputSchema = z.strictObject({
  recordLimit: z.number().int().positive().nullable(),
})

export type ExecuteCsvExtractionRunInputDto = z.input<typeof executeCsvExtractionRunInputSchema>

export const csvExtractionRecordStatusSchema = z.enum(["running", "success", "error", "cancelled"])

export type CsvExtractionRecordStatusDto = z.output<typeof csvExtractionRecordStatusSchema>

/** One row of the file, with what the agent answered for it. */
export const csvExtractionRecordOutputSchema = z.object({
  id: z.uuid(),
  rowIndex: z.number(),
  status: csvExtractionRecordStatusSchema,
  /** The row's values, by column id. */
  inputData: z.record(z.string(), z.unknown()).nullable(),
  /** The fields of the agent's schema, as the agent filled them in. */
  agentRawOutput: z.record(z.string(), z.unknown()).nullable(),
  errorDetails: z.string().nullable(),
})

export type CsvExtractionRecordOutputDto = z.output<typeof csvExtractionRecordOutputSchema>

const pageNumberSchema = z.codec(z.string(), z.number().int().min(0), {
  decode: (text) => Number(text),
  encode: (value) => String(value),
})

/**
 * A page of the rows. The API sorts by `rowIndex`, `status`, `input_<column id>` or
 * `agent_<field>`, and by row otherwise.
 */
export const csvExtractionRecordsQuerySchema = z.strictObject({
  page: pageNumberSchema,
  limit: pageNumberSchema,
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

export const csvExtractionRecordsOutputSchema = z.object({
  records: z.array(csvExtractionRecordOutputSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type CsvExtractionRecordsOutputDto = z.output<typeof csvExtractionRecordsOutputSchema>
