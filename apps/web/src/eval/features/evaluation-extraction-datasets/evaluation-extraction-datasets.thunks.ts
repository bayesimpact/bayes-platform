import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { ThunkConfig } from "@/common/store/types"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetFile,
  EvaluationExtractionDatasetFileColumn,
  EvaluationExtractionDatasetSchemaColumn,
  PaginatedEvaluationExtractionDatasetRecords,
} from "./evaluation-extraction-datasets.models"
import { evaluationExtractionDatasetsActions } from "./evaluation-extraction-datasets.slice"

const listFiles = createAsyncThunk<EvaluationExtractionDatasetFile[], void, ThunkConfig>(
  "datasets/listFiles",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionDatasets.getAllFiles(params)
  },
)

const listDatasets = createAsyncThunk<EvaluationExtractionDataset[], void, ThunkConfig>(
  "datasets/listDatasets",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionDatasets.getAll(params)
  },
)

const listRecords = createAsyncThunk<
  PaginatedEvaluationExtractionDatasetRecords,
  {
    datasetId: string
    page?: number
    limit?: number
    columnFilters?: Record<string, string>
    sortBy?: string
    sortOrder?: "asc" | "desc"
  },
  ThunkConfig
>("datasets/listRecords", async (args, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.evaluationExtractionDatasets.getRecords({
    ...params,
    ...args,
  })
})

const getFileColumns = createAsyncThunk<
  EvaluationExtractionDatasetFileColumn[],
  { documentId: string },
  ThunkConfig
>("datasets/getColumns", async ({ documentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.evaluationExtractionDatasets.getFileColumns({
    ...params,
    documentId,
  })
})

const createOne = createAsyncThunk<{ success: true }, { name: string }, ThunkConfig>(
  "datasets/createOne",
  async (payload, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionDatasets.createOne({
      ...params,
      payload,
    })
  },
)

const updateOne = createAsyncThunk<
  { success: true },
  {
    datasetId: string
    documentId: string
    name: string
    columns: EvaluationExtractionDatasetSchemaColumn[]
  },
  ThunkConfig
>(
  "datasets/updateOne",
  async ({ datasetId, documentId, name, columns }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId, datasetId, documentId }
    const payload = { name, columns }
    return await services.evaluationExtractionDatasets.updateOne({
      ...params,
      payload,
    })
  },
)

const uploadFile = createAsyncThunk<void, { file: File }, ThunkConfig>(
  "datasets/uploadFile",
  async ({ file }, { extra: { services }, getState, dispatch }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    await services.documents.uploadMany({
      ...params,
      files: [file],
      sourceType: "evaluationExtractionDataset",
      onFileProcessed: (result) => {
        dispatch(evaluationExtractionDatasetsActions.setFileProcessed())

        if (result.status === "error") {
          const title = `Error uploading file "${result.file.name}"`
          const description = result.error.message
          dispatch(
            notificationsActions.show({
              title: `${title}: ${description}`,
              type: "error",
            }),
          )
          dispatch(
            evaluationExtractionDatasetsActions.setFileError({
              error: { title, description },
            }),
          )
        }
      },
    })
  },
)

const deleteFiles = createAsyncThunk<void, { fileIds: string[] }, ThunkConfig>(
  "datasets/deleteFiles",
  async ({ fileIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await Promise.all(
      fileIds.map((fileId) =>
        services.documents.deleteOne({ organizationId, projectId, documentId: fileId }),
      ),
    )
  },
)

const renameOne = createAsyncThunk<
  { success: true },
  { datasetId: string; name: string },
  ThunkConfig
>("datasets/renameOne", async ({ datasetId, name }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId, datasetId }
  return await services.evaluationExtractionDatasets.renameOne({
    ...params,
    payload: { name },
  })
})

const deleteOne = createAsyncThunk<void, { datasetId: string }, ThunkConfig>(
  "datasets/deleteOne",
  async ({ datasetId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.evaluationExtractionDatasets.deleteOne({ organizationId, projectId, datasetId })
  },
)

export const evaluationExtractionDatasetsThunks = {
  listDatasets,
  listRecords,
  listFiles,
  createOne,
  renameOne,
  deleteOne,
  getFileColumns,
  uploadFile,
  updateOne,
  deleteFiles,
}
