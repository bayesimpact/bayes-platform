import type { RootState } from "@/common/store"

export const selectResourceLibrariesStatus = (state: RootState) =>
  state.resourceLibraries.data.status

export const selectResourceLibrariesError = (state: RootState) => state.resourceLibraries.data.error

export const selectResourceLibrariesData = (state: RootState) => state.resourceLibraries.data

export const selectCurrentResourceLibraryId = (state: RootState) =>
  state.currentIds.resourceLibraryId

export const selectCurrentResourceId = (state: RootState) => state.currentIds.resourceId
