import {
  type AgentLocale,
  AgentModel,
  type CreateAgentDto,
  DocumentsRagMode,
} from "@caseai-connect/api-contracts"
import type { Agent } from "@/common/features/agents/agents.models"
import {
  agentDefaultOutputJsonSchemaMap,
  agentDefaultPromptMap,
} from "./default-agent-values/default-agent-values.helpers"

/**
 * Default field values used when creating an agent (see AgentCreator). The agent editor itself
 * is update-only and seeds each tab form from the existing agent, so it does not use this.
 */
export function getDefaultFormValues({
  agentType,
  language,
}: {
  agentType: Agent["type"]
  language: AgentLocale
}): CreateAgentDto {
  const value = {
    type: agentType,
    name: "",
    instructions: agentDefaultPromptMap[agentType],
    greetingMessage: undefined,
    documentsRagMode: DocumentsRagMode.All,
    model: AgentModel.Gemini25Flash,
    temperature: 0.0,
    locale: language,
    tagsToAdd: [],
    projectAgentSessionCategoryIds: [],
    resourceLibraryIds: [],
  }

  if (["form", "extraction"].includes(agentType)) {
    // @ts-expect-error - This is valid because of the conditional check on agentType, but TypeScript can't infer that for some reason
    value.outputJsonSchema = agentDefaultOutputJsonSchemaMap[agentType]
  }

  return value
}
