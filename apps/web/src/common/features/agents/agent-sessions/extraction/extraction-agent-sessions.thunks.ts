import { createAsyncThunk } from "@reduxjs/toolkit"
import { selectPlaygroundRevision } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Document } from "@/studio/features/documents/documents.models"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"
import { patchExtractionSessionStatus } from "./extraction-agent-sessions.actions"
import type {
  ExtractionAgentSession,
  ExtractionAgentSessionResult,
  ExtractionAgentSessionSummary,
} from "./extraction-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }
type ThunkConfigWithSignal = ThunkConfig & { serializedErrorType: Error }

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

  const others = await services.extractionAgentSessions.getAll(params)

  const csvSessions = await services.agentCsvExtractionRuns.getAll(params)

  return { csvSessions, others }
})

const listMyDocuments = createAsyncThunk<Document[], void, ThunkConfig>(
  "extractionAgentSessions/listMyDocuments",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.extractionAgentSessions.listMyDocuments({
      organizationId,
      projectId,
      agentId,
    })
  },
)

const executeOne = createAsyncThunk<
  ExtractionAgentSessionResult,
  { agentId: string; onSuccess: (runId: string) => void } & (
    | { file: File }
    | { document: Document }
  ),
  ThunkConfig
>("extractionAgentSessions/executeOne", async (params, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })

  const document =
    "file" in params
      ? await services.extractionAgentSessions.uploadDocument({
          organizationId,
          projectId,
          agentId,
          file: params.file,
        })
      : params.document

  // The version the playground runs. `undefined` while the history is loading, which lets the
  // API apply its own default.
  const agentSettingsRevision = selectPlaygroundRevision({ agentId })(state)

  return await services.extractionAgentSessions.executeOne({
    organizationId,
    projectId,
    agentId,
    documentId: document.id,
    agentSettingsRevision,
  })
})

const streamSessionStatus = createAsyncThunk<void, void, ThunkConfigWithSignal>(
  "extractionAgentSessions/streamSessionStatus",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.extractionAgentSessions.streamSessionStatus({
      organizationId,
      projectId,
      agentId,
      signal,
      onStatusChanged: (event) => {
        dispatch(
          patchExtractionSessionStatus({
            extractionAgentSessionId: event.extractionAgentSessionId,
            agentId: event.agentId,
            status: event.status,
            updatedAt: event.updatedAt,
          }),
        )
      },
    })
  },
)

const deleteMyDocuments = createAsyncThunk<void, { documentIds: string[] }, ThunkConfig>(
  "extractionAgentSessions/deleteMyDocuments",
  async ({ documentIds }, { extra: { services }, getState }) => {
    const state = getState()
    // Through the extraction agent, like the upload: the run documents are not project documents.
    const params = {
      organizationId: getCurrentId({ state, name: "organizationId" }),
      projectId: getCurrentId({ state, name: "projectId" }),
      agentId: getCurrentId({ state, name: "agentId" }),
    }
    await Promise.all(
      documentIds.map((documentId) =>
        services.extractionAgentSessions.deleteMyDocument({ ...params, documentId }),
      ),
    )
  },
)

const getOne = createAsyncThunk<ExtractionAgentSession, { agentSessionId: string }, ThunkConfig>(
  "extractionAgentSessions/getOne",
  async ({ agentSessionId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    const params = { organizationId, projectId, agentId }
    return await services.extractionAgentSessions.getOne({ ...params, agentSessionId })
  },
)

export const extractionAgentSessionsThunks = {
  getOne,
  executeOne,
  streamSessionStatus,
  listMyDocuments,
  deleteMyDocuments,
  getAll,
}
