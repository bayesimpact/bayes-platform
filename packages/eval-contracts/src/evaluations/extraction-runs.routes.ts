import { z } from "zod"
import { PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { successOutputSchema } from "../review-campaigns/review-campaigns.dto"
import {
  extractionRunExecuteInputSchema,
  extractionRunInputSchema,
  extractionRunOutputSchema,
  extractionRunParamsSchema,
  extractionRunRecordsOutputSchema,
  extractionRunRecordsQuerySchema,
} from "./extraction-runs.dto"

const RUNS_PATH = `${PROJECT_PATH}/evaluation-extraction-runs`
const RUN_PATH = `${RUNS_PATH}/:evaluationExtractionRunId`

/** The extraction runs of a project, and their records, for who evaluates its agents. */
export const EvalExtractionRunsRoutes = {
  getAll: defineSchemaRoute({
    method: "get",
    path: RUNS_PATH,
    params: projectParamsSchema,
    response: z.array(extractionRunOutputSchema),
  }),
  getOne: defineSchemaRoute({
    method: "get",
    path: RUN_PATH,
    params: extractionRunParamsSchema,
    response: extractionRunOutputSchema,
  }),
  getRecords: defineSchemaRoute({
    method: "get",
    path: `${RUN_PATH}/records`,
    params: extractionRunParamsSchema,
    query: extractionRunRecordsQuerySchema,
    response: extractionRunRecordsOutputSchema,
  }),
  /** Creates a run, which waits: `executeOne` starts it. */
  createOne: defineSchemaRoute({
    method: "post",
    path: RUNS_PATH,
    params: projectParamsSchema,
    body: extractionRunInputSchema,
    response: extractionRunOutputSchema,
  }),
  executeOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/execute`,
    params: extractionRunParamsSchema,
    body: extractionRunExecuteInputSchema,
    response: extractionRunOutputSchema,
  }),
  /** Asks again the records that failed. */
  retryOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/retry`,
    params: extractionRunParamsSchema,
    response: extractionRunOutputSchema,
  }),
  cancelOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/cancel`,
    params: extractionRunParamsSchema,
    response: extractionRunOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: RUN_PATH,
    params: extractionRunParamsSchema,
    response: successOutputSchema,
  }),
}
