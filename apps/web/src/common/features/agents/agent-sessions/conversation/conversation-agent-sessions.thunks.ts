import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "./conversation-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const getAll = createAsyncThunk<ConversationAgentSession[], { agentId: string }, ThunkConfig>(
  "conversationAgentSessions/getAll",
  async ({ agentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })

    return services.conversationAgentSessions.getAll({
      organizationId,
      projectId,
      agentId,
      type: buildType(),
    })
  },
)

const listSubSessions = createAsyncThunk<
  { agentSessionId: string; subSessions: ConversationSubSession[] },
  { agentId: string; agentSessionId: string },
  ThunkConfig
>(
  "conversationAgentSessions/listSubSessions",
  async ({ agentId, agentSessionId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })

    const subSessions = await services.conversationAgentSessions.listSubSessions({
      organizationId,
      projectId,
      agentId,
      agentSessionId,
      type: buildType(),
    })
    return { agentSessionId, subSessions }
  },
)

export const conversationAgentSessionsThunks = { getAll, listSubSessions }
