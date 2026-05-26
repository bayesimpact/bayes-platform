import { createListenerMiddleware } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/common/store/types"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  // FIXME: watch moun/unmount
  // listenerMiddleware.startListening({
  //   predicate(_, currentState, originalState) {
  //     return hasProjectChanged(originalState, currentState)
  //   },
  //   effect: (_, listenerApi) => {
  //     listenerApi.dispatch(projectAnalyticsActions.reset())
  //   },
  // })
}

export const projectAnalyticsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
