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
  // Keep the volatile timestamp at the very END so the stable content above
  // forms a byte-stable prefix that Vertex/Gemini implicit caching can reuse
  // across runs. Putting the daily-changing date first would invalidate the
  // whole cached prefix on every date rollover.
  return `${agent.defaultPrompt}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools({ names: toolNames, descriptions: toolDescriptions, agent })}

${promptHelpers.language(agent.locale)}

${promptHelpers.now()}`
}
