import { createListenerMiddleware } from "@reduxjs/toolkit"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { currentIdsActions } from "@/studio/store/currentIds.slice"
import { organizationsActions } from "./organizations.slice"
import { createOrganization, updateOrganization } from "./organizations.thunks"

// Create typed listener middleware
const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: organizationsActions.mount,
  effect: async (_, listenerApi) => {
    await listenerApi.dispatch(fetchMe())
  },
})

listenerMiddleware.startListening({
  actionCreator: createOrganization.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Organization created successfully",
        type: "success",
      }),
    )
    await listenerApi.dispatch(fetchMe())
    listenerApi.dispatch(currentIdsActions.setOrganizationId(action.payload.id))
  },
})
listenerMiddleware.startListening({
  actionCreator: createOrganization.rejected,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Organization creation failed",
        type: "error",
      }),
    )
  },
})

listenerMiddleware.startListening({
  actionCreator: updateOrganization.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Organization renamed successfully",
        type: "success",
      }),
    )
    await listenerApi.dispatch(fetchMe())
    action.meta.arg.onSuccess?.()
  },
})

listenerMiddleware.startListening({
  actionCreator: updateOrganization.rejected,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(
      notificationsActions.show({
        title: "Failed to rename organization",
        type: "error",
      }),
    )
  },
})

export { listenerMiddleware as organizationsMiddleware }
