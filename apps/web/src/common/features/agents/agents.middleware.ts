import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"
import { hasProjectChanged } from "../projects/projects.selectors"
import { listAgents } from "./agents.thunks"

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
  }

  return {
    listenerMiddleware,
    registerListeners,
  }
}
