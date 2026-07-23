import { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import type { z } from "zod"
import type { Agent } from "../../../../../common/features/agents/agents.models"
import { conversationAgentDefaultValues } from "./conversation-agent-default-values"
import { extractionAgentDefaultValues } from "./extraction-agent-default-values"

export function buildOutputJsonSchema({
  envSchema,
  defaultSchema,
}: {
  envSchema: string | undefined
  defaultSchema: z.infer<typeof outputJsonSchemaSchema>
}): z.infer<typeof outputJsonSchemaSchema> {
  if (!envSchema) return defaultSchema

  try {
    const parsedSchema = JSON.parse(envSchema)
    if (outputJsonSchemaSchema.safeParse(parsedSchema).success) {
      return parsedSchema
    } else {
      console.error("Invalid output JSON schema in environment variable. Using default schema.")
      return defaultSchema
    }
  } catch {
    console.error(
      "Failed to parse output JSON schema from environment variable. Using default schema.",
    )
    return defaultSchema
  }
}

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
