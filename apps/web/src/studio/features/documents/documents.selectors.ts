import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"

export const selectDocumentsStatus = (state: RootState) => state.documents.data.status

export const selectDocumentsError = (state: RootState) => state.documents.data.error

export const selectDocumentsData = (state: RootState) => state.documents.data

export const selectUploaderState = (state: RootState) => state.documents.uploader

export const selectIsEmbeddingStatusStreamActive = (state: RootState) =>
  state.documents.embeddingStatusStream.isActive

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

export const selectDocumentSourceType = (state: RootState) => state.documents.currentSourceType
