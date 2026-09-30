import { DOCUMENT_SOURCE_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import {
  selectCurrentProjectId,
  selectMyProjectsList,
} from "@/common/features/projects/projects.selectors"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { fetchMyProjects, listProjects } from "@/common/features/projects/projects.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"
import { documentSourcesActions } from "./document-sources.slice"
import { listDocumentSources } from "./document-sources.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function canReadDocumentSources(state: RootState): boolean {
  const projectId = selectCurrentProjectId(state)
  const myProjects = selectMyProjectsList(state)
  if (!projectId || !myProjects) return false
  const project = myProjects.find((accessibleProject) => accessibleProject.id === projectId)
  return project?.permissions.includes(DOCUMENT_SOURCE_READ_PERMISSION) ?? false
}

function registerListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      projectsActions.mount,
      listProjects.fulfilled,
      fetchMyProjects.fulfilled,
      documentSourcesActions.mount,
    ),
    effect: async (_, listenerApi) => {
      if (!canReadDocumentSources(listenerApi.getState())) return
      await listenerApi.dispatch(listDocumentSources())
    },
  })
}

registerListeners()

export const documentSourcesMiddleware = { listenerMiddleware, registerListeners }
