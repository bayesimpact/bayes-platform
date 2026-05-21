import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Document } from "./documents.models"

export const selectDocumentsStatus = (state: RootState) => state.studio.documents.data.status

export const selectDocumentsError = (state: RootState) => state.studio.documents.data.error

export const selectDocumentsData = (state: RootState) => state.studio.documents.data

export const selectCurrentDocumentId = (state: RootState) =>
  state.studio.documents.currentDocumentId

export const selectDocumentData = createSelector(
  [selectDocumentsData, selectCurrentDocumentId],
  (documentsData, documentId): AsyncData<Document> => {
    if (!documentId) return { status: ADS.Error, value: null, error: "No document selected" }
    if (!ADS.isFulfilled(documentsData)) return { ...documentsData }
    const document = documentsData.value.find((r) => r.id === documentId)
    if (!document)
      return { status: ADS.Error, value: null, error: "Document not found in current project" }
    return { status: ADS.Fulfilled, value: document, error: null }
  },
)

export const selectUploaderState = (state: RootState) => state.studio.documents.uploader

export const selectIsEmbeddingStatusStreamActive = (state: RootState) =>
  state.studio.documents.embeddingStatusStream.isActive

export const selectHasDocumentsInProgress = createSelector(
  [selectDocumentsData],
  (documentsData) => {
    if (!ADS.isFulfilled(documentsData)) {
      return false
    }

    return documentsData.value.some(
      (document) =>
        document.embeddingStatus === "pending" ||
        document.embeddingStatus === "queued" ||
        document.embeddingStatus === "processing",
    )
  },
)

export const selectIsCrawlProgressStreamActive = (state: RootState) =>
  state.studio.documents.crawlProgressStream.isActive

export const selectHasDocumentsCrawling = createSelector([selectDocumentsData], (documentsData) => {
  if (!ADS.isFulfilled(documentsData)) {
    return false
  }
  return documentsData.value.some(
    (document) => document.sourceType === "webCrawl" && document.embeddingStatus === "pending",
  )
})

export const selectCrawlProgressByDocumentId = (state: RootState) =>
  state.studio.documents.crawlProgressByDocumentId
