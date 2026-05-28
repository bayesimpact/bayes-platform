import type { Agent } from "@/domains/agents/agent.entity"
import { promptHelpers } from "./helpers"

export function buildConversationAgentPrompt({
  agent,
  toolDescriptions,
  toolNames,
}: {
  agent: Agent
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}): string {
  return `${promptHelpers.now()}

## Identity
You are **${agent.name}**, a conversational AI assistant.

${agent.defaultPrompt}

${promptHelpers.tools(toolNames, toolDescriptions)}

${promptHelpers.language(agent.locale)}`
}
