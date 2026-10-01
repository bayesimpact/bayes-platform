import { DOCUMENT_SOURCE_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { listProjects } from "@/common/features/projects/projects.thunks"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import { documentSourcesActions } from "./document-sources.slice"
import { listDocumentSources } from "./document-sources.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function canReadDocumentSources(state: RootState): boolean {
  const project = selectCurrentProjectData(state)
  if (!ADS.isFulfilled(project)) return false
  return project.value.permissions.includes(DOCUMENT_SOURCE_READ_PERMISSION)
}

function registerListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(projectsActions.mount, listProjects.fulfilled, documentSourcesActions.mount),
    effect: async (_, listenerApi) => {
      if (!canReadDocumentSources(listenerApi.getState())) return
      await listenerApi.dispatch(listDocumentSources())
    },
  })
}

registerListeners()

export const documentSourcesMiddleware = { listenerMiddleware, registerListeners }
