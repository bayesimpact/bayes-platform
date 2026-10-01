import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { DocumentSource } from "./document-sources.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const currentProjectScope = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const listDocumentSources = createAsyncThunk<DocumentSource[], void, ThunkConfig>(
  "documentSources/list",
  async (_, { extra: { services }, getState }) => {
    return await services.documentSources.getAll(currentProjectScope(getState()))
  },
)

export const deleteDocumentSource = createAsyncThunk<
  string,
  { documentSourceId: string },
  ThunkConfig
>("documentSources/delete", async ({ documentSourceId }, { extra: { services }, getState }) => {
  await services.documentSources.deleteOne({
    ...currentProjectScope(getState()),
    documentSourceId,
  })
  return documentSourceId
})
