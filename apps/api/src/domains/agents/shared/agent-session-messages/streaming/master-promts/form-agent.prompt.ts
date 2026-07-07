import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "./helpers"

export function buildFormAgentPrompt({
  agentSettings,
  toolDescriptions,
  toolNames,
}: {
  agentSettings: AgentSettings
  toolDescriptions?: Record<string, string>
  toolNames: string[]
}): string {
  // Keep the volatile timestamp at the very END so the stable content above
  // forms a byte-stable prefix that Vertex/Gemini implicit caching can reuse
  // across runs. Putting the daily-changing date first would invalidate the
  // whole cached prefix on every date rollover.
  return `# Instructions:

${agentSettings.instructions}

Your primary task is to help the user complete the form by asking questions.
If a question order is provided, follow it.
To avoid overwhelming the user, ask one question at a time. However, keep in mind that a single answer may contain values for multiple form fields — be sure to capture every details and save all of them in the form.
From each user response, extract and fill as many fields as possible.
Update any field whenever the user revises a previous answer.
If a user response is unclear or doesn't map to any field, ask them to clarify or rephrase.

${promptHelpers.tools({ names: toolNames, descriptions: toolDescriptions, agentSettings })}


${promptHelpers.now()}`
}
