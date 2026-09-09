import type { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import type { z } from "zod"
import { runtimeConfig } from "@/config/runtime-config"
import { buildOutputJsonSchema } from "./default-agent-values.helpers"

export const formAgentDefaultValues = {
  prompt:
    runtimeConfig.defaultFormAgentPrompt ??
    `Your main task is to help the user fill out the form by asking questions and providing guidance. Ask one question at a time to fill out the form.`,

  getOutputJsonSchema: () => {
    const envSchema = runtimeConfig.defaultFormAgentSchema

    const defaultSchema: z.infer<typeof outputJsonSchemaSchema> = {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "What country do you live in?",
        },
        language: {
          type: "string",
          description: "What is your preferred language?",
        },
      },
      required: ["country", "language"],
      propertyOrdering: ["country", "language"],
    }

    return buildOutputJsonSchema({ envSchema, defaultSchema })
  },
}
