import type { SuccessResponseDTO } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { isStudioInterface } from "@/studio/routes/helpers"
import type { ConversationAgentSession } from "../../conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSession } from "../../extraction/extraction-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

type BaseAgentSession = ConversationAgentSession | ExtractionAgentSession

export const createAgentChatSession = createAsyncThunk<
  BaseAgentSession,
  { agentType: Agent["type"]; agentId: string; onSuccess?: (agentSessionId: string) => void },
  ThunkConfig
>(
  "agentSession/createAgentChatSession",
  async ({ agentType, agentId }, { extra: { services }, getState }) => {
    if (agentType !== "conversation") {
      throw new Error(`Creation of ${agentType} agent session is not supported yet`)
    }

    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return services.conversationAgentSessions.createOne({
      ...params,
      agentId,
      type: buildType(),
    })
  },
)

export const deleteAgentSession = createAsyncThunk<
  SuccessResponseDTO,
  { agentType: Agent["type"]; agentId: string; agentSessionId: string; onSuccess?: () => void },
  ThunkConfig
>(
  "agentSession/deleteAgentSession",
  async ({ agentType, agentId, agentSessionId }, { extra: { services }, getState }) => {
    if (agentType !== "conversation" && agentType !== "extraction") {
      throw new Error(`Unsupported agent type: ${agentType}`)
    }
    const map = {
      conversation: services.conversationAgentSessions,
      extraction: services.extractionAgentSessions,
    }
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return map[agentType].deleteOne({
      ...params,
      agentId,
      agentSessionId,
      type: buildType(),
    })
  },
)

export function buildType() {
  return isStudioInterface() ? "playground" : "live"
}
