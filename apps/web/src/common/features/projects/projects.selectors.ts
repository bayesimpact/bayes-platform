import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "@/common/store"
import { ADS, type AsyncData } from "@/common/store/async-data-status"
import type { Project } from "./projects.models"

export const selectProjectsData = (state: RootState) => state.projects.data

export const selectCurrentProjectId = (state: RootState) => state.currentIds.projectId

export const selectCurrentProjectData = createSelector(
  [selectProjectsData, selectCurrentProjectId],
  (projectsData, projectId): AsyncData<Project> => {
    if (!projectId) return { status: ADS.Error, value: null, error: "No project selected" }

    if (!ADS.isFulfilled(projectsData)) return { ...projectsData }

    const project = projectsData.value?.find((p) => p.id === projectId)

    if (!project) return { status: ADS.Error, value: null, error: "No project found" }

    return { status: ADS.Fulfilled, value: project, error: null }
  },
)

export const hasProjectChanged = (prev: RootState, next: RootState): boolean => {
  if (!prev.currentIds || !next.currentIds) return false
  const prevData = selectCurrentProjectData(prev)
  const nextData = selectCurrentProjectData(next)
  return prevData.value?.id !== nextData.value?.id && !!nextData.value?.id
}
