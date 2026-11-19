import { z } from "zod"
import { PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { successOutputSchema } from "../review-campaigns/review-campaigns.dto"
import {
  conversationDatasetNameInputSchema,
  conversationDatasetOutputSchema,
  conversationDatasetParamsSchema,
  conversationDatasetRecordInputSchema,
  conversationDatasetRecordParamsSchema,
  conversationDatasetRecordsInputSchema,
  conversationDatasetRecordsOutputSchema,
  conversationDatasetRecordsQuerySchema,
} from "./conversation-datasets.dto"

const DATASETS_PATH = `${PROJECT_PATH}/evaluation-conversation-datasets`
const DATASET_PATH = `${DATASETS_PATH}/:datasetId`

/** The conversation datasets of a project, and their records, for who evaluates its agents. */
export const EvalConversationDatasetsRoutes = {
  getAll: defineSchemaRoute({
    method: "get",
    path: DATASETS_PATH,
    params: projectParamsSchema,
    response: z.array(conversationDatasetOutputSchema),
  }),
  createOne: defineSchemaRoute({
    method: "post",
    path: `${DATASETS_PATH}/createOne`,
    params: projectParamsSchema,
    body: conversationDatasetNameInputSchema,
    response: successOutputSchema,
  }),
  renameOne: defineSchemaRoute({
    method: "patch",
    path: `${DATASET_PATH}/rename`,
    params: conversationDatasetParamsSchema,
    body: conversationDatasetNameInputSchema,
    response: successOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: DATASET_PATH,
    params: conversationDatasetParamsSchema,
    response: successOutputSchema,
  }),
  getRecords: defineSchemaRoute({
    method: "get",
    path: `${DATASET_PATH}/records`,
    params: conversationDatasetParamsSchema,
    query: conversationDatasetRecordsQuerySchema,
    response: conversationDatasetRecordsOutputSchema,
  }),
  createRecord: defineSchemaRoute({
    method: "post",
    path: `${DATASET_PATH}/records`,
    params: conversationDatasetParamsSchema,
    body: conversationDatasetRecordInputSchema,
    response: successOutputSchema,
  }),
  createRecords: defineSchemaRoute({
    method: "post",
    path: `${DATASET_PATH}/records/bulk`,
    params: conversationDatasetParamsSchema,
    body: conversationDatasetRecordsInputSchema,
    response: successOutputSchema,
  }),
  updateRecord: defineSchemaRoute({
    method: "patch",
    path: `${DATASET_PATH}/records/:recordId`,
    params: conversationDatasetRecordParamsSchema,
    body: conversationDatasetRecordInputSchema,
    response: successOutputSchema,
  }),
  deleteRecord: defineSchemaRoute({
    method: "delete",
    path: `${DATASET_PATH}/records/:recordId`,
    params: conversationDatasetRecordParamsSchema,
    response: successOutputSchema,
  }),
}
