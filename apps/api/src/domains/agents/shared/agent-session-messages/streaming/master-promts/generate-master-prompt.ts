import type { Agent } from "@/domains/agents/agent.entity"
import { buildConversationAgentPrompt } from "./conversation-agent.prompt"
import { buildFormAgentPrompt } from "./form-agent.prompt"

export function generateMasterPrompt(params: {
  agent: Agent
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
