import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
import { PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { successOutputSchema } from "../review-campaigns/review-campaigns.dto"
import {
  conversationRunExecuteInputSchema,
  conversationRunInputSchema,
  conversationRunOutputSchema,
  conversationRunParamsSchema,
  conversationRunRecordsOutputSchema,
  conversationRunRecordsQuerySchema,
} from "./conversation-runs.dto"

const RUNS_PATH = `${PROJECT_PATH}/evaluation-conversation-runs`
const RUN_PATH = `${RUNS_PATH}/:evaluationConversationRunId`

/** The conversation runs of a project, and their records, for who evaluates its agents. */
export const EvalConversationRunsRoutes = {
  getAll: defineSchemaRoute({
    method: "get",
    path: RUNS_PATH,
    params: projectParamsSchema,
    response: z.array(conversationRunOutputSchema),
  }),
  getOne: defineSchemaRoute({
    method: "get",
    path: RUN_PATH,
    params: conversationRunParamsSchema,
    response: conversationRunOutputSchema,
  }),
  getRecords: defineSchemaRoute({
    method: "get",
    path: `${RUN_PATH}/records`,
    params: conversationRunParamsSchema,
    query: conversationRunRecordsQuerySchema,
    response: conversationRunRecordsOutputSchema,
  }),
  /** Creates a run, which waits: `executeOne` starts it. */
  createOne: defineSchemaRoute({
    method: "post",
    path: RUNS_PATH,
    params: projectParamsSchema,
    body: conversationRunInputSchema,
    response: conversationRunOutputSchema,
  }),
  executeOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/execute`,
    params: conversationRunParamsSchema,
    body: conversationRunExecuteInputSchema,
    response: conversationRunOutputSchema,
  }),
  /** Asks again the records that failed. */
  retryOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/retry`,
    params: conversationRunParamsSchema,
    response: conversationRunOutputSchema,
  }),
  cancelOne: defineSchemaRoute({
    method: "post",
    path: `${RUN_PATH}/cancel`,
    params: conversationRunParamsSchema,
    response: conversationRunOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: RUN_PATH,
    params: conversationRunParamsSchema,
    response: successOutputSchema,
  }),
}
