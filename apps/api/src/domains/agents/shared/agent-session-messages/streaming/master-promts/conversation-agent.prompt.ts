import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "./helpers"

export function buildConversationAgentPrompt({
  agent,
  agentSettings,
  toolDescriptions,
  toolNames,
  handoff,
  contextSections = [],
  hasChatInterfacePrompt = false,
}: {
  agent: Agent
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
  handoff?: { parentAgentName: string }
  contextSections?: string[]
  /** Whether the project explains the chat interface to its agents (its `chat-interface-prompt` flag). */
  hasChatInterfacePrompt?: boolean
}): string {
  // Keep the volatile timestamp LAST so the stable content above forms a
  // byte-stable prefix that Vertex/Gemini implicit caching can reuse across
  // runs (putting the daily-changing date first would invalidate the whole
  // cached prefix on every date rollover).
  return `${agentSettings.instructions}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools({ names: toolNames, descriptions: toolDescriptions, agentSettings })}

${promptHelpers.mcpAppUis(toolDescriptions)}

${hasChatInterfacePrompt ? promptHelpers.interfaceMarkup() : ""}

${handoff ? promptHelpers.handoff(handoff) : ""}

${contextSections.join("\n\n")}

${promptHelpers.language(agentSettings.locale)}

${promptHelpers.now()}`
}
