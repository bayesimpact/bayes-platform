import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetFile,
  EvaluationExtractionDatasetFileColumn,
  PaginatedEvaluationExtractionDatasetRecords,
} from "./evaluation-extraction-datasets.models"
import { evaluationExtractionDatasetsThunks } from "./evaluation-extraction-datasets.thunks"

export type UploaderError = { title: string; description: string }
type UploaderState = {
  status: "idle" | "uploading" | "completed"
  total: number
  processed: number
  errors: UploaderError[] | null
}

interface State {
  data: AsyncData<EvaluationExtractionDataset[]>
  records: AsyncData<PaginatedEvaluationExtractionDatasetRecords>
  files: AsyncData<EvaluationExtractionDatasetFile[]>
  fileColumns: AsyncData<EvaluationExtractionDatasetFileColumn[]>
  uploader: UploaderState
  isUpdatingDataset: boolean
}

const initialState: State = {
  data: defaultAsyncData,
  records: defaultAsyncData,
  files: defaultAsyncData,
  fileColumns: defaultAsyncData,
  uploader: {
    status: "idle",
    total: 0,
    processed: 0,
    errors: null,
  },
  isUpdatingDataset: false,
}

const slice = createSlice({
  name: "extractionDatasets",
  initialState,
  reducers: {
    reset: () => initialState,
    mount: () => {},
    unmount: () => {},
    resetRecords: (state) => {
      state.records = defaultAsyncData
    },
    resetUploaderCounters: (state) => {
      state.uploader.total = 0
      state.uploader.processed = 0
      state.uploader.status = "idle"
    },
    setFileProcessed: (state) => {
      if (state.uploader.processed + 1 === state.uploader.total) {
        state.uploader.status = "completed"
      } else if (state.uploader.status === "uploading") {
        state.uploader.processed += 1
      }
    },
    setFileError: (state, action: PayloadAction<{ error: UploaderError }>) => {
      if (!state.uploader.errors) {
        state.uploader.errors = []
      }
      state.uploader.errors.push(action.payload.error)

      if (
        state.uploader.processed + (state.uploader.errors ? state.uploader.errors.length : 0) ===
        state.uploader.total
      ) {
        state.uploader.status = "completed"
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(evaluationExtractionDatasetsThunks.uploadFile.pending, (state) => {
      state.uploader.status = "uploading"
      state.uploader.total = 1
      state.uploader.processed = 0
    })

    builder
      .addCase(evaluationExtractionDatasetsThunks.listFiles.pending, (state) => {
        if (!ADS.isFulfilled(state.files)) state.files.status = ADS.Loading
        state.files.error = null
      })
      .addCase(evaluationExtractionDatasetsThunks.listFiles.fulfilled, (state, action) => {
        state.files = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationExtractionDatasetsThunks.listFiles.rejected, (state, action) => {
        state.files.status = ADS.Error
        state.files.error = action.error.message || "Failed to list files"
      })

    builder
      .addCase(evaluationExtractionDatasetsThunks.listDatasets.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(evaluationExtractionDatasetsThunks.listDatasets.fulfilled, (state, action) => {
        state.isUpdatingDataset = false
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationExtractionDatasetsThunks.listDatasets.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list datasets"
      })

    builder
      .addCase(evaluationExtractionDatasetsThunks.listRecords.pending, (state) => {
        if (!ADS.isFulfilled(state.records)) state.records.status = ADS.Loading
        state.records.error = null
      })
      .addCase(evaluationExtractionDatasetsThunks.listRecords.fulfilled, (state, action) => {
        state.records = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationExtractionDatasetsThunks.listRecords.rejected, (state, action) => {
        state.records.status = ADS.Error
        state.records.error = action.error.message || "Failed to list records"
      })

    builder
      .addCase(evaluationExtractionDatasetsThunks.getFileColumns.pending, (state) => {
        if (!ADS.isFulfilled(state.fileColumns)) state.fileColumns.status = ADS.Loading
        state.fileColumns.error = null
      })
      .addCase(evaluationExtractionDatasetsThunks.getFileColumns.fulfilled, (state, action) => {
        state.fileColumns = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationExtractionDatasetsThunks.getFileColumns.rejected, (state, action) => {
        state.fileColumns.status = ADS.Error
        state.fileColumns.error = action.error.message || "Failed to get file columns"
      })

    builder
      .addCase(evaluationExtractionDatasetsThunks.updateOne.pending, (state) => {
        state.isUpdatingDataset = true
      })
      .addCase(evaluationExtractionDatasetsThunks.updateOne.rejected, (state) => {
        state.isUpdatingDataset = false
      })
  },
})

export type { State as DatasetsState }
export const datasetsInitialState = initialState
export const evaluationExtractionDatasetsActions = {
  ...slice.actions,
  ...evaluationExtractionDatasetsThunks,
}
export const evaluationExtractionDatasetsSlice = slice
