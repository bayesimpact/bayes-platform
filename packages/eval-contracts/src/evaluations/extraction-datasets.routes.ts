import { z } from "zod"
import { LEGACY_PROJECT_PATH, projectParamsSchema } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import { successOutputSchema } from "../review-campaigns/review-campaigns.dto"
import { datasetNameInputSchema } from "./datasets.dto"
import {
  extractionDatasetFileColumnOutputSchema,
  extractionDatasetFileOutputSchema,
  extractionDatasetFileParamsSchema,
  extractionDatasetFilePresignInputSchema,
  extractionDatasetFilePresignOutputSchema,
  extractionDatasetOutputSchema,
  extractionDatasetParamsSchema,
  extractionDatasetRecordsOutputSchema,
  extractionDatasetRecordsQuerySchema,
  extractionDatasetSetupInputSchema,
  extractionDatasetSetupParamsSchema,
} from "./extraction-datasets.dto"

const DATASETS_PATH = `${LEGACY_PROJECT_PATH}/evaluation-extraction-datasets`
const DATASET_PATH = `${DATASETS_PATH}/:datasetId`
const FILE_PATH = `${DATASETS_PATH}/files/:documentId`

/**
 * The extraction datasets of a project, the CSV files they are built from and their records, for
 * who evaluates its agents.
 */
export const EvalExtractionDatasetsRoutes = {
  /** The files a person uploaded and confirmed. */
  getAllFiles: defineSchemaRoute({
    method: "get",
    path: `${DATASETS_PATH}/files`,
    params: projectParamsSchema,
    response: z.array(extractionDatasetFileOutputSchema),
  }),
  /** Starts an upload: the bytes go to the signed URL, then `confirmFile` lists the file. */
  presignFile: defineSchemaRoute({
    method: "post",
    path: `${DATASETS_PATH}/files/presign`,
    params: projectParamsSchema,
    body: extractionDatasetFilePresignInputSchema,
    response: extractionDatasetFilePresignOutputSchema,
  }),
  confirmFile: defineSchemaRoute({
    method: "post",
    path: `${FILE_PATH}/confirm`,
    params: extractionDatasetFileParamsSchema,
    response: extractionDatasetFileOutputSchema,
  }),
  getFileColumns: defineSchemaRoute({
    method: "get",
    path: `${FILE_PATH}/columns`,
    params: extractionDatasetFileParamsSchema,
    response: z.array(extractionDatasetFileColumnOutputSchema),
  }),
  deleteFile: defineSchemaRoute({
    method: "delete",
    path: FILE_PATH,
    params: extractionDatasetFileParamsSchema,
    response: successOutputSchema,
  }),
  getAll: defineSchemaRoute({
    method: "get",
    path: DATASETS_PATH,
    params: projectParamsSchema,
    response: z.array(extractionDatasetOutputSchema),
  }),
  createOne: defineSchemaRoute({
    method: "post",
    path: `${DATASETS_PATH}/createOne`,
    params: projectParamsSchema,
    body: datasetNameInputSchema,
    response: successOutputSchema,
  }),
  /** Builds the records of a dataset from a file, with the name and the role of each column. */
  setUpOne: defineSchemaRoute({
    method: "patch",
    path: `${DATASET_PATH}/files/:documentId/update`,
    params: extractionDatasetSetupParamsSchema,
    body: extractionDatasetSetupInputSchema,
    response: successOutputSchema,
  }),
  renameOne: defineSchemaRoute({
    method: "patch",
    path: `${DATASET_PATH}/rename`,
    params: extractionDatasetParamsSchema,
    body: datasetNameInputSchema,
    response: successOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "delete",
    path: DATASET_PATH,
    params: extractionDatasetParamsSchema,
    response: successOutputSchema,
  }),
  getRecords: defineSchemaRoute({
    method: "get",
    path: `${DATASET_PATH}/records`,
    params: extractionDatasetParamsSchema,
    query: extractionDatasetRecordsQuerySchema,
    response: extractionDatasetRecordsOutputSchema,
  }),
}
