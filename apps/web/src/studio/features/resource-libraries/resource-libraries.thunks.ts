import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Resource, ResourceFile, ResourceLibrary } from "./resource-libraries.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }
type ResourceLibraryFields = { title: string; resources: Resource[] }

const currentProjectScope = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const listResourceLibraries = createAsyncThunk<ResourceLibrary[], void, ThunkConfig>(
  "resourceLibraries/list",
  async (_, { extra: { services }, getState }) => {
    return await services.resourceLibraries.getAll(currentProjectScope(getState()))
  },
)

export const createResourceLibrary = createAsyncThunk<
  ResourceLibrary,
  { fields: ResourceLibraryFields; onSuccess: (resourceLibrary: ResourceLibrary) => void },
  ThunkConfig
>("resourceLibraries/create", async ({ fields }, { extra: { services }, getState }) => {
  return await services.resourceLibraries.createOne(currentProjectScope(getState()), fields)
})

export const updateResourceLibrary = createAsyncThunk<
  void,
  { resourceLibraryId: string; fields: ResourceLibraryFields; onSuccess: () => void },
  ThunkConfig
>(
  "resourceLibraries/update",
  async ({ resourceLibraryId, fields }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.updateOne(
      { ...currentProjectScope(getState()), resourceLibraryId },
      fields,
    )
  },
)

export const deleteResourceLibrary = createAsyncThunk<
  void,
  { resourceLibraryId: string; onSuccess: () => void },
  ThunkConfig
>("resourceLibraries/delete", async ({ resourceLibraryId }, { extra: { services }, getState }) => {
  return await services.resourceLibraries.deleteOne({
    ...currentProjectScope(getState()),
    resourceLibraryId,
  })
})

export const uploadResourceFile = createAsyncThunk<ResourceFile, { file: File }, ThunkConfig>(
  "resourceLibraries/uploadFile",
  async ({ file }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.uploadResourceFile(
      currentProjectScope(getState()),
      file,
    )
  },
)
