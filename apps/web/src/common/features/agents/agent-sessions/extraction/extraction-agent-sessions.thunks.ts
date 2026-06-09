import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Document } from "@/studio/features/documents/documents.models"
import { uploadDocument } from "@/studio/features/documents/documents.thunks"
import { isStudioInterface } from "@/studio/routes/helpers"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type {
  ExtractionAgentSession,
  ExtractionAgentSessionResult,
  ExtractionAgentSessionSummary,
} from "./extraction-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const getAll = createAsyncThunk<
  {
    csvSessions: AgentCsvExtractionRun[]
    others: ExtractionAgentSessionSummary[]
  },
  { agentId: string },
  ThunkConfig
>("extractionAgentSessions/getAll", async ({ agentId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId, agentId }

  const others = await services.extractionAgentSessions.getAll({
    ...params,
    type: buildType(),
  })

  const csvSessions = await services.agentCsvExtractionRuns.getAll(params)

  return { csvSessions, others }
})

const listMyDocuments = createAsyncThunk<Document[], void, ThunkConfig>(
  "extractionAgentSessions/listMyDocuments",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.documents.listMyExtractionDocuments({ organizationId, projectId })
  },
)

const executeOne = createAsyncThunk<
  ExtractionAgentSessionResult,
  { agentId: string; onSuccess: () => void } & ({ file: File } | { document: Document }),
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

    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })

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
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const params = { organizationId, projectId, agentId }
    return await services.extractionAgentSessions.getOne({
      ...params,
      agentSessionId,
      type: isStudio ? "playground" : "live",
    })
  },
)

export const extractionAgentSessionsThunks = {
  getOne,
  executeOne,
  listMyDocuments,
  getAll,
}
