import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { ResourceFields, ResourceFile, ResourceLibrary } from "./resource-libraries.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }
type ResourceLibraryFields = { title: string }

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

export const addResource = createAsyncThunk<
  ResourceLibrary,
  { resourceLibraryId: string; fields: ResourceFields; onSuccess: () => void },
  ThunkConfig
>(
  "resourceLibraries/addResource",
  async ({ resourceLibraryId, fields }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.addResource(
      { ...currentProjectScope(getState()), resourceLibraryId },
      fields,
    )
  },
)

export const updateResource = createAsyncThunk<
  ResourceLibrary,
  { resourceLibraryId: string; resourceId: string; fields: ResourceFields; onSuccess: () => void },
  ThunkConfig
>(
  "resourceLibraries/updateResource",
  async ({ resourceLibraryId, resourceId, fields }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.updateResource(
      { ...currentProjectScope(getState()), resourceLibraryId, resourceId },
      fields,
    )
  },
)

export const deleteResource = createAsyncThunk<
  void,
  { resourceLibraryId: string; resourceId: string; onSuccess: () => void },
  ThunkConfig
>(
  "resourceLibraries/deleteResource",
  async ({ resourceLibraryId, resourceId }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.deleteResource({
      ...currentProjectScope(getState()),
      resourceLibraryId,
      resourceId,
    })
  },
)

export const uploadResourceFile = createAsyncThunk<ResourceFile, { file: File }, ThunkConfig>(
  "resourceLibraries/uploadFile",
  async ({ file }, { extra: { services }, getState }) => {
    return await services.resourceLibraries.uploadResourceFile(
      currentProjectScope(getState()),
      file,
    )
  },
)
