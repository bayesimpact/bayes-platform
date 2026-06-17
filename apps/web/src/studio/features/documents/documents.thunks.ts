import type { DocumentSourceType } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { DocumentTagsUpdateFields } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "./documents.models"
import { selectDocumentSourceType } from "./documents.selectors"
import { documentsActions } from "./documents.slice"
import { shouldTriggerResyncForUnknownDocumentEvent } from "./documents-stream-events"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listDocuments = createAsyncThunk<Document[], void, ThunkConfig>(
  "documents/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const sourceType = selectDocumentSourceType(state)
    return await services.documents.getAll({ organizationId, projectId, sourceType })
  },
)

export const uploadDocument = createAsyncThunk<
  Document,
  {
    file: File
    sourceType: DocumentSourceType
    tagIds?: string[]
    onSuccess?: (params: { documentId: string }) => void
  },
  ThunkConfig
>(
  "documents/uploadOne",
  async ({ file, sourceType, tagIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.documents.uploadOne({
      organizationId,
      projectId,
      file,
      sourceType,
      tagIds,
    })
  },
)

export const uploadDocuments = createAsyncThunk<
  void,
  { files: File[]; sourceType: DocumentSourceType; tagIds?: string[] },
  ThunkConfig
>(
  "documents/uploadMany",
  async ({ files, sourceType, tagIds }, { extra: { services }, getState, dispatch }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.documents.uploadMany({
      organizationId,
      projectId,
      files,
      sourceType,
      tagIds,
      onFileProcessed: (result) => {
        dispatch(documentsActions.setOneDocumentProcessed())

        if (result.status === "error") {
          const title = `Error uploading file "${result.file.name}"`
          const description = result.error.message
          dispatch(
            notificationsActions.show({
              title: `${title}: ${description}`,
              type: "error",
            }),
          )
          dispatch(documentsActions.setOneDocumentError({ error: { title, description } }))
        }
      },
    })
  },
)

export const updateDocument = createAsyncThunk<
  void,
  {
    documentId: string
    fields: Partial<Pick<Document, "title">> & DocumentTagsUpdateFields
    onSuccess?: () => void
  },
  ThunkConfig
>("documents/update", async ({ documentId, fields }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.documents.updateOne({
    organizationId,
    projectId,
    documentId,
    payload: fields,
  })
})

export const deleteDocument = createAsyncThunk<
  void,
  { documentId: string; onSuccess?: () => void },
  ThunkConfig
>("documents/delete", async ({ documentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.documents.deleteOne({ organizationId, projectId, documentId })
})

export const reprocessDocument = createAsyncThunk<void, { documentId: string }, ThunkConfig>(
  "documents/reprocess",
  async ({ documentId }, { extra: { services }, getState, dispatch }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.documents.reprocessOne({ organizationId, projectId, documentId })
    dispatch(
      documentsActions.patchDocumentEmbeddingStatus({
        documentId,
        embeddingStatus: "queued",
        embeddingError: null,
        updatedAt: Date.now(),
      }),
    )
  },
)

export const getDocumentTemporaryUrl = createAsyncThunk<
  { url: string },
  { documentId: string },
  ThunkConfig
>("documents/getTemporaryUrl", async ({ documentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })

  return await services.documents.getTemporaryUrl({ organizationId, projectId, documentId })
})

export const getDocumentIsPublic = createAsyncThunk<
  { isPublicDocument: boolean },
  { documentId: string },
  ThunkConfig
>("documents/getIsPublic", async ({ documentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })

  return await services.documents.getIsPublic({ organizationId, projectId, documentId })
})

export const crawlUrl = createAsyncThunk<
  { message: string },
  { url: string; name?: string },
  ThunkConfig
>("documents/crawlUrl", async ({ url, name }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.documents.crawlUrl({ organizationId, projectId, url, name })
})

export const reCrawlUrl = createAsyncThunk<
  { message: string },
  { documentId: string },
  ThunkConfig
>("documents/reCrawlUrl", async ({ documentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.documents.reCrawlUrl({ organizationId, projectId, documentId })
})

export const cancelCrawl = createAsyncThunk<void, { documentId: string }, ThunkConfig>(
  "documents/cancelCrawl",
  async ({ documentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.documents.cancelCrawl({ organizationId, projectId, documentId })
  },
)

export const streamDocumentCrawlProgresses = createAsyncThunk<void, void, ThunkConfig>(
  "documents/streamCrawlProgress",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })

    await services.documents.streamCrawlProgress({
      organizationId,
      projectId,
      signal,
      onProgressChanged: ({ documentId, pagesCrawled }) => {
        dispatch(
          documentsActions.patchDocumentCrawlProgress({
            documentId,
            pagesCrawled,
          }),
        )
      },
    })
  },
)

export const streamDocumentEmbeddingStatuses = createAsyncThunk<void, void, ThunkConfig>(
  "documents/streamEmbeddingStatus",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    let hasTriggeredUnknownDocumentResync = false

    await services.documents.streamEmbeddingStatus({
      organizationId,
      projectId,
      signal,
      onStatusChanged: ({ documentId, embeddingStatus, embeddingError, updatedAt }) => {
        const state = getState()
        if (
          shouldTriggerResyncForUnknownDocumentEvent({
            documentsData: state.documents.data,
            documentId,
            hasTriggeredUnknownDocumentResync,
          })
        ) {
          hasTriggeredUnknownDocumentResync = true
          void dispatch(listDocuments())
          return
        }

        if (!ADS.isFulfilled(state.documents.data)) {
          return
        }

        const documentExistsInCurrentList = state.documents.data.value.some(
          (document) => document.id === documentId,
        )
        if (!documentExistsInCurrentList) {
          return
        }

        dispatch(
          documentsActions.patchDocumentEmbeddingStatus({
            documentId,
            embeddingStatus,
            embeddingError,
            updatedAt,
          }),
        )
      },
    })
  },
)
