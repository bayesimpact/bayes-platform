import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"

/**
 * Where a session records which agent is in control of the conversation. A
 * handoff sets it to the sub-agent; the sub-agent's conclusion clears it.
 * Conversation sessions use ConversationAgentSessionsService, public (embed)
 * sessions PublicAgentSessionsService, keyed on their own table.
 */
export type ActiveAgentController = {
  setActiveAgent(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    activeAgentId: string
  }): Promise<void>
  clearActiveAgentIfCurrent(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    expectedActiveAgentId: string
  }): Promise<void>
}
