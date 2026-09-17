import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "./helpers"

export function buildConversationAgentPrompt({
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
  handoff?: { parentAgentName: string }
}): string {
  // Keep the volatile timestamp LAST so the stable content above forms a
  // byte-stable prefix that Vertex/Gemini implicit caching can reuse across
  // runs (putting the daily-changing date first would invalidate the whole
  // cached prefix on every date rollover).
  return `${agentSettings.instructions}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools({ names: toolNames, descriptions: toolDescriptions, agentSettings })}

${promptHelpers.mcpAppUis(toolDescriptions)}

${handoff ? promptHelpers.handoff(handoff) : ""}

${promptHelpers.language(agentSettings.locale)}

${promptHelpers.now()}`
}
