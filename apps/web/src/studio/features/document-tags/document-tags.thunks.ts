import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { DocumentTag } from "./document-tags.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listDocumentTags = createAsyncThunk<DocumentTag[], void, ThunkConfig>(
  "documentTags/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.documentTags.getAll(params)
  },
)

export const createDocumentTag = createAsyncThunk<
  DocumentTag,
  {
    fields: Pick<DocumentTag, "name"> & Partial<Pick<DocumentTag, "description" | "parentId">>
    onSuccess: (documentTag: DocumentTag) => void
  },
  ThunkConfig
>("documentTags/create", async (payload, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.documentTags.createOne(params, {
    name: payload.fields.name,
    description: payload.fields.description,
    parentId: payload.fields.parentId,
  })
})

export const updateDocumentTag = createAsyncThunk<
  void,
  {
    documentTagId: string
    fields: Pick<DocumentTag, "name" | "description" | "parentId">
    onSuccess: () => void
  },
  ThunkConfig
>("documentTags/update", async ({ documentTagId, fields }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.documentTags.updateOne({ ...params, documentTagId }, fields)
})

export const deleteDocumentTag = createAsyncThunk<
  void,
  {
    documentTagId: string
    onSuccess: () => void
  },
  ThunkConfig
>("documentTags/delete", async ({ documentTagId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.documentTags.deleteOne({ ...params, documentTagId })
})
