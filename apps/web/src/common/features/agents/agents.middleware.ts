import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { hasProjectChanged } from "../projects/projects.selectors"
import { agentsActions } from "./agents.slice"
import { listAgents, listAvailableModels } from "./agents.thunks"

/** Each interface decides whether its agent list carries the draft revisions. */
export function createAgentsMiddleware({ includeDrafts }: { includeDrafts: boolean }) {
  const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

  function registerListeners() {
    // Refresh Agents when current project changes
    listenerMiddleware.startListening({
      predicate(_, currentState, originalState) {
        return hasProjectChanged(originalState, currentState)
      },
      effect: async (_, listenerApi) => {
        await listenerApi.dispatch(listAgents({ includeDrafts }))
      },
    })

  // Only the routes that read the catalog mount it (Studio and Eval), so Desk never fetches it.
  listenerMiddleware.startListening({
    actionCreator: agentsActions.mountAvailableModels,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAvailableModels())
    },
  })

  return {
    listenerMiddleware,
    registerListeners,
  }
}
