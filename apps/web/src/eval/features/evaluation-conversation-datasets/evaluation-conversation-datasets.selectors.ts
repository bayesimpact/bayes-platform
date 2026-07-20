import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"

// RECORDS
export const selectConversationDatasetRecordsData = (state: RootState) =>
  state.conversationDatasets.records

// DATASETS
export const selectConversationDatasetsData = (state: RootState) => state.conversationDatasets.data
export const selectCurrentConversationDatasetId = (state: RootState) => state.currentIds.datasetId
export const selectCurrentConversationDatasetData = createSelector(
  [selectConversationDatasetsData, selectCurrentConversationDatasetId],
  (datasetsData, datasetId) => {
    if (ADS.isFulfilled(datasetsData)) {
      const dataset = datasetsData.value.find((candidate) => candidate.id === datasetId)
      if (dataset) {
        return { status: ADS.Fulfilled, error: null, value: dataset }
      } else {
        return { status: ADS.Error, error: "Dataset not found", value: null }
      }
    }
    return datasetsData
  },
)
