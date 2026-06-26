import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { FormAgentSession, FormSubSession } from "./form-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const getAll = createAsyncThunk<FormAgentSession[], { agentId: string }, ThunkConfig>(
  "formAgentSessions/getAll",
  async ({ agentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })

    return services.formAgentSessions.getAll({
      organizationId,
      projectId,
      agentId,
      type: buildType(),
    })
  },
)

const listSubSessions = createAsyncThunk<
  { agentSessionId: string; subSessions: FormSubSession[] },
  { agentId: string; agentSessionId: string },
  ThunkConfig
>(
  "formAgentSessions/listSubSessions",
  async ({ agentId, agentSessionId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })

    const subSessions = await services.formAgentSessions.listSubSessions({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
      type: buildType(),
    })
    return { agentSessionId, subSessions }
  },
)

export const formAgentSessionsThunks = { getAll, listSubSessions }
