import type { DocumentSourceType } from "@caseai-connect/api-contracts"
import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Document } from "./documents.models"
import { listDocuments, uploadDocuments } from "./documents.thunks"

export type UploaderError = { title: string; description: string }
type UploaderState = {
  status: "idle" | "uploading" | "completed"
  total: number
  processed: number
  errors: UploaderError[] | null
}
type EmbeddingStatusStreamState = {
  isActive: boolean
}
type CrawlProgressStreamState = {
  isActive: boolean
}
interface State {
  currentSourceType: DocumentSourceType
  data: AsyncData<Document[]>
  uploader: UploaderState
  embeddingStatusStream: EmbeddingStatusStreamState
  crawlProgressStream: CrawlProgressStreamState
  crawlProgressByDocumentId: Record<string, number>
}

const initialState: State = {
  currentSourceType: "project",
  data: defaultAsyncData,
  uploader: {
    status: "idle",
    total: 0,
    processed: 0,
    errors: null,
  },
  embeddingStatusStream: {
    isActive: false,
  },
  crawlProgressStream: {
    isActive: false,
  },
  crawlProgressByDocumentId: {},
}

function mergeDocumentsByUpdatedAt({
  currentDocuments,
  incomingDocuments,
}: {
  currentDocuments: Document[]
  incomingDocuments: Document[]
}): Document[] {
  const currentDocumentById = new Map(
    currentDocuments.map((currentDocument) => [currentDocument.id, currentDocument] as const),
  )

  return incomingDocuments.map((incomingDocument) => {
    const currentDocument = currentDocumentById.get(incomingDocument.id)
    if (!currentDocument) return incomingDocument
    return currentDocument.updatedAt > incomingDocument.updatedAt
      ? currentDocument
      : incomingDocument
  })
}

const slice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    projectMount: () => {},
    projectUnmount: () => {},
    webSourcesMount: () => {},
    webSourcesUnmount: () => {},
    reset: () => initialState,
    resetUploaderCounters: (state) => {
      state.uploader.total = 0
      state.uploader.processed = 0
      state.uploader.status = "idle"
    },
    setOneDocumentProcessed: (state) => {
      if (state.uploader.processed + 1 === state.uploader.total) {
        state.uploader.status = "completed"
      } else if (state.uploader.status === "uploading") {
        state.uploader.processed += 1
      }
    },
    setOneDocumentError: (state, action: PayloadAction<{ error: UploaderError }>) => {
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
    setCurrentSourceType: (state, action: PayloadAction<{ sourceType: DocumentSourceType }>) => {
      state.currentSourceType = action.payload.sourceType
    },
    startEmbeddingStatusStream: (state) => {
      state.embeddingStatusStream.isActive = true
    },
    stopEmbeddingStatusStream: (state) => {
      state.embeddingStatusStream.isActive = false
    },
    patchDocumentEmbeddingStatus: (
      state,
      action: PayloadAction<{
        documentId: string
        embeddingStatus: Document["embeddingStatus"]
        embeddingError: Document["embeddingError"]
        updatedAt: number
      }>,
    ) => {
      if (!ADS.isFulfilled(state.data)) return
      const document = state.data.value.find(
        (candidateDocument) => candidateDocument.id === action.payload.documentId,
      )
      if (!document) return
      if (document.updatedAt > action.payload.updatedAt) return
      document.embeddingStatus = action.payload.embeddingStatus
      document.embeddingError = action.payload.embeddingError
      document.updatedAt = action.payload.updatedAt
      if (
        action.payload.embeddingStatus === "completed" ||
        action.payload.embeddingStatus === "failed"
      ) {
        delete state.crawlProgressByDocumentId[action.payload.documentId]
      }
    },
    startCrawlProgressStream: (state) => {
      state.crawlProgressStream.isActive = true
    },
    stopCrawlProgressStream: (state) => {
      state.crawlProgressStream.isActive = false
    },
    patchDocumentCrawlProgress: (
      state,
      action: PayloadAction<{ documentId: string; pagesCrawled: number }>,
    ) => {
      const previous = state.crawlProgressByDocumentId[action.payload.documentId] ?? 0
      if (action.payload.pagesCrawled < previous) return
      state.crawlProgressByDocumentId[action.payload.documentId] = action.payload.pagesCrawled
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listDocuments.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listDocuments.fulfilled, (state, action) => {
        const mergedDocuments = ADS.isFulfilled(state.data)
          ? mergeDocumentsByUpdatedAt({
              currentDocuments: state.data.value,
              incomingDocuments: action.payload,
            })
          : action.payload

        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: mergedDocuments,
        }

        const stillCrawling = new Set(
          mergedDocuments
            .filter(
              (document) =>
                document.sourceType === "webCrawl" && document.embeddingStatus === "pending",
            )
            .map((document) => document.id),
        )
        for (const documentId of Object.keys(state.crawlProgressByDocumentId)) {
          if (!stillCrawling.has(documentId)) {
            delete state.crawlProgressByDocumentId[documentId]
          }
        }
      })
      .addCase(listDocuments.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list documents"
      })

    builder.addCase(uploadDocuments.pending, (state, action) => {
      state.uploader.status = "uploading"
      state.uploader.total = action.meta.arg.files.length
      state.uploader.processed = 0
    })
  },
})

export const documentsActions = { ...slice.actions }
export const documentsSlice = slice
