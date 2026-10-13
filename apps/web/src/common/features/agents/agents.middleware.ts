import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { hasProjectChanged } from "../projects/projects.selectors"
import { agentsActions } from "./agents.slice"
import { listAgents, listAvailableModels } from "./agents.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // Refresh Agents when current project changes
  listenerMiddleware.startListening({
    predicate(_, currentState, originalState) {
      return hasProjectChanged(originalState, currentState)
    },
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAgents())
    },
  })

  // Only the routes that read the catalog mount it (Studio and Eval), so Desk never fetches it.
  listenerMiddleware.startListening({
    actionCreator: agentsActions.mountAvailableModels,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAvailableModels())
    },
  })
}

export const agentsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
