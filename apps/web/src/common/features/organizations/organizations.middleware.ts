import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { currentIdsActions } from "@/studio/store/currentIds.slice"
import { organizationsActions } from "./organizations.slice"
import { createOrganization, fetchOrganizations, updateOrganization } from "./organizations.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

listenerMiddleware.startListening({
  actionCreator: organizationsActions.mount,
  effect: async (_, listenerApi) => {
    await listenerApi.dispatch(fetchOrganizations())
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
    await listenerApi.dispatch(fetchOrganizations())
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
    await listenerApi.dispatch(fetchOrganizations())
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
