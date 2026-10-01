import { createAsyncThunk } from "@reduxjs/toolkit"
import { selectPlaygroundRevision } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { Document } from "@/studio/features/documents/documents.models"
import { isStudioInterface } from "@/studio/routes/helpers"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
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

  const others = await services.extractionAgentSessions.getAll({
    ...params,
    type: buildType(),
  })

  const csvSessions = await services.agentCsvExtractionRuns.getAll({
    ...params,
    type: buildType(),
  })

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
      type: buildType(),
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
  const isStudio = isStudioInterface()
  const type = isStudio ? "playground" : "live"

  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const agentId = getCurrentId({ state, name: "agentId" })

  const document =
    "file" in params
      ? await services.extractionAgentSessions.uploadDocument({
          organizationId,
          projectId,
          agentId,
          type,
          file: params.file,
        })
      : params.document

  // Only Studio may name a version; a Desk run is a live run and the API rejects a revision on
  // one. `undefined` while the history is loading, which lets the API apply its own default.
  const agentSettingsRevision = isStudio ? selectPlaygroundRevision({ agentId })(state) : undefined

  return await services.extractionAgentSessions.executeOne({
    organizationId,
    projectId,
    agentId,
    documentId: document.id,
    type,
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
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await Promise.all(
      documentIds.map((documentId) =>
        services.documents.deleteOne({ organizationId, projectId, documentId }),
      ),
    )
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
  streamSessionStatus,
  listMyDocuments,
  deleteMyDocuments,
  getAll,
}
