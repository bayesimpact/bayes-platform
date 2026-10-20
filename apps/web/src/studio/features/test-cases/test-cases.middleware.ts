import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { evaluationConversationDatasetsActions } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.slice"
import { saveTestCase } from "./test-cases.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // The dataset picker shows record counts, and a new dataset must be offered next time.
  listenerMiddleware.startListening({
    actionCreator: saveTestCase.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "testCase:notifications.saved",
          titleValues: { name: action.meta.arg.datasetName },
          type: "success",
        }),
      )
      await listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets())
    },
  })
}

export const testCasesMiddleware = { listenerMiddleware, registerListeners }
