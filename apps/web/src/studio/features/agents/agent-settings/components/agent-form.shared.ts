import type { CreateAgentDto } from "@caseai-connect/api-contracts"
import type { Agent } from "@/common/features/agents/agents.models"

/**
 * A choice offered by the agent creator dialog. "form" is not an agent type: it
 * creates a conversation agent with the fillForm tool enabled.
 */
export type AgentCreationChoice = Agent["type"] | "form"

/**
 * What the agent creator sends for a choice. The API gives every other setting the default of the
 * agent's type (instructions, result schema, model), and the new agent's settings are a draft.
 */
export function getCreationFields(
  creationChoice: AgentCreationChoice,
): Pick<CreateAgentDto, "type" | "fillFormEnabled"> {
  if (creationChoice === "form") return { type: "conversation", fillFormEnabled: true }
  return { type: creationChoice }
}
