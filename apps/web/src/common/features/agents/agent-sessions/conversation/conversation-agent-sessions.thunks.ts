import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { buildType } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { ConversationAgentSession } from "./conversation-agent-sessions.models"

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

export const conversationAgentSessionsThunks = { getAll }
