import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { listAgentHistory } from "@/studio/features/agents/agent-history.thunks"
import { agentHistoryActions } from "./agent-history.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentHistoryActions.mount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgentHistory())
    },
  })
}
export const agentHistoryMiddleware = { listenerMiddleware, registerListeners }
