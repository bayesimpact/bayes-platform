import { z } from "zod"
import { agentParamsSchema } from "../agent-sessions/agent-sessions.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { temporaryUrlOutputSchema } from "../documents/documents.dto"
import {
  confirmExtractionDocumentInputSchema,
  createCsvExtractionRunInputSchema,
  csvExtractionRecordsOutputSchema,
  csvExtractionRecordsQuerySchema,
  csvExtractionRunDetailOutputSchema,
  csvExtractionRunParamsSchema,
  csvFileColumnOutputSchema,
  deletionOutputSchema,
  executeCsvExtractionRunInputSchema,
  executeExtractionInputSchema,
  executeExtractionOutputSchema,
  extractionDocumentOutputSchema,
  extractionDocumentParamsSchema,
  extractionRunDetailOutputSchema,
  extractionRunParamsSchema,
  presignExtractionDocumentInputSchema,
  presignExtractionDocumentOutputSchema,
} from "./extractions.dto"

const runsPath = "organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/live"

/**
 * The extractions of one document by an extraction agent, and the documents the person uploads
 * for them. Every route answers the signed-in person's own runs and documents only.
 */
export const DeskExtractionsRoutes = {
  getOne: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/:agentSessionId/getOne`,
    params: extractionRunParamsSchema,
    response: extractionRunDetailOutputSchema,
  }),
  executeOne: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/execute`,
    params: agentParamsSchema,
    body: executeExtractionInputSchema,
    response: executeExtractionOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/:agentSessionId/delete`,
    params: extractionRunParamsSchema,
    response: deletionOutputSchema,
  }),
  presignDocument: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/documents/presign`,
    params: agentParamsSchema,
    body: presignExtractionDocumentInputSchema,
    response: presignExtractionDocumentOutputSchema,
  }),
  confirmDocument: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/documents/confirm`,
    params: agentParamsSchema,
    body: confirmExtractionDocumentInputSchema,
    response: extractionDocumentOutputSchema,
  }),
  getMyDocuments: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/documents/mine`,
    params: agentParamsSchema,
    response: z.array(extractionDocumentOutputSchema),
  }),
  deleteMyDocument: defineSchemaRoute({
    method: "post",
    path: `${runsPath}/documents/:documentId/delete`,
    params: extractionDocumentParamsSchema,
    response: deletionOutputSchema,
  }),
}

const csvRunsPath = "organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/live"

/** The extractions of every row of a CSV file, which the person uploads as a document. */
export const DeskCsvExtractionsRoutes = {
  getFileColumns: defineSchemaRoute({
    method: "get",
    path: `${csvRunsPath}/file/:documentId/columns`,
    params: extractionDocumentParamsSchema,
    response: z.array(csvFileColumnOutputSchema),
  }),
  createOne: defineSchemaRoute({
    method: "post",
    path: csvRunsPath,
    params: agentParamsSchema,
    body: createCsvExtractionRunInputSchema,
    response: csvExtractionRunDetailOutputSchema,
  }),
  executeOne: defineSchemaRoute({
    method: "post",
    path: `${csvRunsPath}/:agentCsvExtractionRunId/execute`,
    params: csvExtractionRunParamsSchema,
    body: executeCsvExtractionRunInputSchema,
    response: csvExtractionRunDetailOutputSchema,
  }),
  getOne: defineSchemaRoute({
    method: "get",
    path: `${csvRunsPath}/:agentCsvExtractionRunId`,
    params: csvExtractionRunParamsSchema,
    response: csvExtractionRunDetailOutputSchema,
  }),
  getRecords: defineSchemaRoute({
    method: "get",
    path: `${csvRunsPath}/:agentCsvExtractionRunId/records`,
    params: csvExtractionRunParamsSchema,
    query: csvExtractionRecordsQuerySchema,
    response: csvExtractionRecordsOutputSchema,
  }),
  cancelOne: defineSchemaRoute({
    method: "post",
    path: `${csvRunsPath}/:agentCsvExtractionRunId/cancel`,
    params: csvExtractionRunParamsSchema,
    response: csvExtractionRunDetailOutputSchema,
  }),
  retryOne: defineSchemaRoute({
    method: "post",
    path: `${csvRunsPath}/:agentCsvExtractionRunId/retry`,
    params: csvExtractionRunParamsSchema,
    response: csvExtractionRunDetailOutputSchema,
  }),
  /** Answers 404 until the run ended and its CSV file of results exists. */
  getExportTemporaryUrl: defineSchemaRoute({
    method: "get",
    path: `${csvRunsPath}/:agentCsvExtractionRunId/export/temporary-url`,
    params: csvExtractionRunParamsSchema,
    response: temporaryUrlOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: `${csvRunsPath}/:agentCsvExtractionRunId`,
    params: csvExtractionRunParamsSchema,
    response: deletionOutputSchema,
  }),
}
