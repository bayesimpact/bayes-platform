import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { evaluationConversationDatasetsActions } from "./evaluation-conversation-datasets.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: evaluationConversationDatasetsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(evaluationConversationDatasetsActions.listDatasets())
    },
  })
}

export const evaluationConversationDatasetsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
