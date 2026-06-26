import type { Agent } from "@/domains/agents/agent.entity"
import { promptHelpers } from "./helpers"

export function buildFormAgentPrompt({
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
  return `# Instructions:
${agent.defaultPrompt}

Here are the form fields to fill:
${Object.entries(agent.outputJsonSchema?.properties ?? {})
  .map(
    ([key, value]) => `- ${key}: ${"description" in value ? value.description : "No description"}`,
  )
  .join("\n")}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools(toolNames, toolDescriptions)}

${promptHelpers.language(agent.locale)}

${promptHelpers.now()}`
}
