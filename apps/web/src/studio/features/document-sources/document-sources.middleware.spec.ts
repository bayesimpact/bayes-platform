import { configureStore, type Reducer, type UnknownAction } from "@reduxjs/toolkit"
import { describe, expect, it, vi } from "vitest"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { documentSourceFactory } from "./document-sources.factory"
import { documentSourcesMiddleware } from "./document-sources.middleware"
import { updateDocumentSourceTags } from "./document-sources.thunks"

function buildStore() {
  const services = {
    documentSources: { updateOne: vi.fn().mockRejectedValue(new Error("Request failed")) },
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
      }).prepend(documentSourcesMiddleware.listenerMiddleware.middleware),
  })
  return { store, dispatchedActions }
}

describe("documentSourcesMiddleware", () => {
  it("shows an error notification when the tags of a source cannot be updated", async () => {
    const { store, dispatchedActions } = buildStore()
    const organization = organizationFactory.build()
    const project = projectFactory.transient({ organization }).build()
    const documentSource = documentSourceFactory.transient({ project }).build({ tagIds: [] })

    await store.dispatch(updateDocumentSourceTags({ documentSource, tagIds: ["tag-1"] }))

    await vi.waitFor(() =>
      expect(dispatchedActions).toContainEqual(
        notificationsActions.show({
          titleKey: "documentSource:notifications.tagsUpdateError",
          type: "error",
        }),
      ),
    )
  })
})
