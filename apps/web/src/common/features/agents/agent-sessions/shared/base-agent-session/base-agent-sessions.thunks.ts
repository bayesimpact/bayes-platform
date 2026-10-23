import type {
  BaseAgentSessionTypeDto,
  ConversationAgentSessionTypeDto,
  SuccessResponseDTO,
} from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { selectPlaygroundRevision } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import type { Agent } from "@/common/features/agents/agents.models"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { isStudioInterface } from "@/studio/routes/helpers"
import { isTesterInterface } from "@/tester/routes/helpers"
import type { ConversationAgentSession } from "../../conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSession } from "../../extraction/extraction-agent-sessions.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

type BaseAgentSession = ConversationAgentSession | ExtractionAgentSession

export const createAgentChatSession = createAsyncThunk<
  BaseAgentSession,
  {
    agentType: Agent["type"]
    agentId: string
    /** Values for the {{variables}} the settings revision declares; blanks fall back to its defaults. */
    variables?: Record<string, string>
    onSuccess?: (agentSessionId: string) => void
  },
  ThunkConfig
>(
  "agentSession/createAgentChatSession",
  async ({ agentType, agentId, variables }, { extra: { services }, getState }) => {
    if (agentType !== "conversation") {
      throw new Error(`Creation of ${agentType} agent session is not supported yet`)
    }

    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    const type = buildType()
    // The greeting comes from the version the playground runs. `undefined` while the history is
    // loading, which lets the API greet with the draft, its own playground default.
    const agentSettingsRevision =
      type === "playground" ? selectPlaygroundRevision({ agentId })(state) : undefined
    return services.conversationAgentSessions.createOne({
      ...params,
      agentId,
      type,
      agentSettingsRevision,
      variables,
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

// FIXME: This is a temporary solution to avoid having to duplicate functions for live and playground agent sessions.
export function buildType(): BaseAgentSessionTypeDto {
  return isStudioInterface() ? "playground" : "live"
}

/** The message routes of a conversation also serve a tester's conversation in a review campaign. */
export function buildConversationType(): ConversationAgentSessionTypeDto {
  return isTesterInterface() ? "review_campaign_tester" : buildType()
}
