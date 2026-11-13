import type { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import type { z } from "zod"

export const formAgentDefaultValues = {
  prompt: `Your main task is to help the user fill out the form by asking questions and providing guidance. Ask one question at a time to fill out the form. Always answer in the language of the user's last message.`,

  getOutputJsonSchema: () => {
    const schema: z.infer<typeof outputJsonSchemaSchema> = {
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

    return schema
  },
}
