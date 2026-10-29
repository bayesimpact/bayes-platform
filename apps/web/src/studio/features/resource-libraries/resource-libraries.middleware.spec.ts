import { configureStore, type Reducer, type UnknownAction } from "@reduxjs/toolkit"
import { describe, expect, it, vi } from "vitest"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { resourceLibrariesMiddleware } from "./resource-libraries.middleware"
import { uploadResourceFile } from "./resource-libraries.thunks"

resourceLibrariesMiddleware.registerListeners()

function buildStore() {
  const services = {
    resourceLibraries: {
      uploadResourceFile: vi.fn().mockRejectedValue(new Error("Request failed")),
    },
  }
  const dispatchedActions: UnknownAction[] = []
  const initialState = { currentIds: { organizationId: "organization-1", projectId: "project-1" } }
  const recordingReducer = (state = initialState, action: UnknownAction) => {
    dispatchedActions.push(action)
    return state
  }
  const store = configureStore({
    reducer: recordingReducer as unknown as Reducer<RootState>,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: { services: services as unknown as Services } },
        serializableCheck: false,
      }).prepend(resourceLibrariesMiddleware.listenerMiddleware.middleware),
  })
  return { store, dispatchedActions }
}

describe("resourceLibrariesMiddleware", () => {
  it("shows an error notification when a resource file cannot be uploaded", async () => {
    const { store, dispatchedActions } = buildStore()
    const file = new File(["%PDF-1.4"], "Guide.pdf", { type: "application/pdf" })

    await store.dispatch(uploadResourceFile({ file }))

    await vi.waitFor(() =>
      expect(dispatchedActions).toContainEqual(
        notificationsActions.show({
          titleKey: "actions:fileUploadFailed",
          titleValues: { fileName: "Guide.pdf", errorMessage: "" },
          type: "error",
        }),
      ),
    )
  })
})
