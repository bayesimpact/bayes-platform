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
  return `${promptHelpers.now()}

# Instructions:
${agent.defaultPrompt}

Here are the form fields to fill:
${Object.entries(agent.outputJsonSchema?.properties ?? {})
  .map(
    ([key, value]) => `- ${key}: ${"description" in value ? value.description : "No description"}`,
  )
  .join("\n")}

${promptHelpers.resourceLibraries(agent.resourceLibraries ?? [])}

${promptHelpers.tools(toolNames, toolDescriptions)}

${promptHelpers.language(agent.locale)}`
}
