import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { buildConversationAgentPrompt } from "./conversation-agent.prompt"
import { buildFormAgentPrompt } from "./form-agent.prompt"

export function generateMasterPrompt(params: {
  agent: Agent
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}): string {
  const agentType = params.agent.type
  switch (agentType) {
    case "form":
      return buildFormAgentPrompt(params)
    case "conversation":
      return buildConversationAgentPrompt(params)
    default:
      throw new Error(`Unsupported agent type: ${agentType}`)
  }
}
