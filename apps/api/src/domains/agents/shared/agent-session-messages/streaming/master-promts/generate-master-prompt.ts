import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { buildConversationAgentPrompt } from "./conversation-agent.prompt"

export function generateMasterPrompt({
  agent,
  agentSettings,
  toolDescriptions,
  toolNames,
  handoff,
}: {
  agent: Agent
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
  /** Set when the agent answers as the active sub-agent of a handoff. */
  handoff?: { parentAgentName: string }
}): string {
  switch (agent.type) {
    case "conversation":
      return buildConversationAgentPrompt({
        agent,
        agentSettings,
        toolNames,
        toolDescriptions,
        handoff,
      })
    default:
      throw new Error(`Unsupported agent type: ${agent.type}`)
  }
}
