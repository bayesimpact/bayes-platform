import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentIds } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Document } from "@/studio/features/documents/documents.models"
import { uploadDocument } from "@/studio/features/documents/documents.thunks"
import { isStudioInterface } from "@/studio/routes/helpers"
import type {
  ExtractionAgentSession,
  ExtractionAgentSessionResult,
} from "./extraction-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listMyDocuments = createAsyncThunk<Document[], void, ThunkConfig>(
  "extractionAgentSessions/listMyDocuments",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const { organizationId, projectId } = getCurrentIds({
      state,
      wantedIds: ["organizationId", "projectId"],
    })
    return await services.documents.listMyExtractionDocuments({ organizationId, projectId })
  },
)

const executeOne = createAsyncThunk<
  ExtractionAgentSessionResult,
  { onSuccess: () => void } & ({ file: File } | { document: Document }),
  ThunkConfig
>(
  "extractionAgentSessions/executeOne",
  async (params, { extra: { services }, getState, dispatch }) => {
    const state = getState()
    const isStudio = isStudioInterface()

    const document =
      "file" in params
        ? await dispatch(
            uploadDocument({
              file: params.file,
              sourceType: "extraction",
            }),
          ).unwrap()
        : params.document

    const { organizationId, projectId, agentId } = getCurrentIds({
      state,
      wantedIds: ["organizationId", "projectId", "agentId"],
    })

    return await services.extractionAgentSessions.executeOne({
      organizationId,
      projectId,
      agentId,
      documentId: document.id,
      type: isStudio ? "playground" : "live",
    })
  },
)

const getOne = createAsyncThunk<ExtractionAgentSession, { agentSessionId: string }, ThunkConfig>(
  "extractionAgentSessions/getOne",
  async ({ agentSessionId }, { extra: { services }, getState }) => {
    const state = getState()
    const isStudio = isStudioInterface()
    const params = getCurrentIds({
      state,
      wantedIds: ["organizationId", "projectId", "agentId"],
    })
    return await services.extractionAgentSessions.getOne({
      ...params,
      agentSessionId,
      type: isStudio ? "playground" : "live",
    })
  },
)

export const extractionAgentSessionThunks = {
  getOne,
  executeOne,
  listMyDocuments,
}
