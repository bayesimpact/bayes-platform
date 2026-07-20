import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectCurrentConversationDatasetId } from "./evaluation-conversation-datasets.selectors"
import { evaluationConversationDatasetsActions } from "./evaluation-conversation-datasets.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets())
    },
  })

  // Load the first records page when the dataset route mounts (or the
  // URL-driven currentIds.datasetId changes, via useMount's refreshOn).
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.mountRecords,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const datasetId = selectCurrentConversationDatasetId(state)
      if (!datasetId) return

      const recordsData = state.conversationDatasets.records
      const limit = ADS.isFulfilled(recordsData) ? recordsData.value.limit : DEFAULT_PAGE_SIZE
      listenerApi.dispatch(
        evaluationConversationDatasetsActions.listRecords({ datasetId, page: 0, limit }),
      )
    },
  })

  // Clear stale records when leaving the dataset route or switching dataset.
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.unmountRecords,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationDatasetsActions.resetRecords())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      evaluationConversationDatasetsActions.createOne.fulfilled,
      evaluationConversationDatasetsActions.renameOne.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.createOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: `${action.meta.arg.name} created successfully`,
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.createOne.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: `${action.meta.arg.name} creation failed`,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.renameOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: `${action.meta.arg.name} renamed successfully`,
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.renameOne.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: `${action.meta.arg.name} rename failed`,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.deleteOne.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets())
      listenerApi.dispatch(notificationsActions.show({ title: "Dataset deleted", type: "success" }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.deleteOne.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to delete dataset", type: "error" }),
      )
    },
  })

  registerRecordListeners()
}

export const evaluationConversationDatasetsMiddleware = {
  listenerMiddleware,
  registerListeners,
}

function registerRecordListeners() {
  // Refetch the current records page after a record mutation.
  const refetchCurrentRecordsPage = async (
    datasetId: string,
    listenerApi: { getState: () => RootState; dispatch: AppDispatch },
  ) => {
    const recordsData = listenerApi.getState().conversationDatasets.records
    const currentPage = ADS.isFulfilled(recordsData) ? recordsData.value.page : undefined
    const currentLimit = ADS.isFulfilled(recordsData) ? recordsData.value.limit : undefined
    await listenerApi.dispatch(
      evaluationConversationDatasetsActions.listRecords({
        datasetId,
        page: currentPage,
        limit: currentLimit,
      }),
    )
  }

  // Creating or deleting a record also changes the dataset's record count shown
  // in the dataset list, so refetch both. Updating a record's content does not.
  const refetchAfterRecordCountChange = async (
    datasetId: string,
    listenerApi: { getState: () => RootState; dispatch: AppDispatch },
  ) => {
    await Promise.all([
      refetchCurrentRecordsPage(datasetId, listenerApi),
      listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets()),
    ])
  }

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.createRecord.fulfilled,
    effect: async (action, listenerApi) => {
      await refetchAfterRecordCountChange(action.meta.arg.datasetId, listenerApi)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.updateRecord.fulfilled,
    effect: async (action, listenerApi) => {
      await refetchCurrentRecordsPage(action.meta.arg.datasetId, listenerApi)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.deleteRecord.fulfilled,
    effect: async (action, listenerApi) => {
      await refetchAfterRecordCountChange(action.meta.arg.datasetId, listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.createRecord.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Record created", type: "success" }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.createRecord.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to create record", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.updateRecord.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Record updated", type: "success" }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.updateRecord.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to update record", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.deleteRecord.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Record deleted", type: "success" }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.deleteRecord.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to delete record", type: "error" }),
      )
    },
  })
}
