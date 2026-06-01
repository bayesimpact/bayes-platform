import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "./helpers"

export function buildConversationAgentPrompt({
  agent,
  agentSettings,
  toolDescriptions,
  toolNames,
}: {
  agent: Agent
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}): string {
  // Keep the volatile timestamp at the very END so the stable content above
  // forms a byte-stable prefix that Vertex/Gemini implicit caching can reuse
  // across runs. Putting the daily-changing date first would invalidate the
  // whole cached prefix on every date rollover.
  return `${agentSettings.instructions}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools({ names: toolNames, descriptions: toolDescriptions, agent })}

${promptHelpers.language(agentSettings.locale)}

${promptHelpers.now()}`
}
