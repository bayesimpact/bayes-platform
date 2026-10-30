import {
  type AgentModel,
  type CreateAgentDto,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  agentDefaultOutputJsonSchemaMap,
  agentDefaultPromptMap,
} from "../../components/default-agent-values/default-agent-values.helpers"
import { formAgentDefaultValues } from "../../components/default-agent-values/form-agent-default-values"

/**
 * A choice offered by the agent creator dialog. "form" is not an agent type: it
 * creates a conversation agent with the fillForm tool enabled.
 */
export type AgentCreationChoice = Agent["type"] | "form"

/**
 * Default field values used when creating an agent (see AgentCreator). The agent editor itself
 * is update-only and seeds each tab form from the existing agent, so it does not use this.
 */
export function getDefaultFormValues({
  creationChoice,
  defaultModel,
  defaultModelOptions,
}: {
  creationChoice: AgentCreationChoice
  /** The model a new agent starts on, from the catalog. */
  defaultModel: AgentModel
  /** That model's default options, from the catalog. */
  defaultModelOptions: Record<string, unknown>
}): CreateAgentDto {
  const sharedValues = {
    name: "",
    greetingMessage: undefined,
    documentsRagMode: DocumentsRagMode.All,
    model: defaultModel,
    providerOptions: defaultModelOptions,
    tagsToAdd: [],
    projectAgentSessionCategoryIds: [],
    resourceLibraryIds: [],
  }

  if (creationChoice === "extraction") {
    return {
      ...sharedValues,
      type: "extraction",
      instructions: agentDefaultPromptMap.extraction,
      outputJsonSchema: agentDefaultOutputJsonSchemaMap.extraction,
    }
  }

  if (creationChoice === "form") {
    return {
      ...sharedValues,
      type: "conversation",
      instructions: formAgentDefaultValues.prompt,
      fillFormEnabled: true,
      outputJsonSchema: formAgentDefaultValues.getOutputJsonSchema(),
    }
  }

  return {
    ...sharedValues,
    type: "conversation",
    instructions: agentDefaultPromptMap.conversation,
  }
}
