import type { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import type { z } from "zod"

export const extractionAgentDefaultValues = {
  prompt: `Extract structured information from the uploaded document.

Return ONLY the JSON object that matches the provided output schema.

Rules:
- Do not add fields that are not defined in the schema.
- Use null when a required value is not present in the document.
- Keep original values as written in the document when possible.
- Do not include explanations or markdown.`,

  getOutputJsonSchema: () => {
    const schema: z.infer<typeof outputJsonSchemaSchema> = {
      type: "object",
      properties: {
        numberOfParagraphs: {
          type: "number",
          description: "How many paragraphs do you want to extract?",
        },
        language: {
          type: "string",
          description: "What is the language of the document?",
        },
      },
      required: ["numberOfParagraphs", "language"],
    }

    return schema
  },
}
