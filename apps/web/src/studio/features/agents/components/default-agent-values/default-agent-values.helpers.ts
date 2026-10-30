import type { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import type { z } from "zod"
import type { Agent } from "../../../../../common/features/agents/agents.models"
import { conversationAgentDefaultValues } from "./conversation-agent-default-values"
import { extractionAgentDefaultValues } from "./extraction-agent-default-values"

export const agentDefaultPromptMap: Record<Agent["type"], string> = {
  conversation: conversationAgentDefaultValues.prompt,
  extraction: extractionAgentDefaultValues.prompt,
}

export const agentDefaultOutputJsonSchemaMap: Record<
  "extraction",
  z.infer<typeof outputJsonSchemaSchema>
> = {
  extraction: extractionAgentDefaultValues.getOutputJsonSchema(),
}
