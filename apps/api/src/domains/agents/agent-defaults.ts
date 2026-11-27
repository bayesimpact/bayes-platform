import type { AgentType } from "@caseai-connect/api-contracts"

/** A result schema, as the settings store it. */
type OutputJsonSchema = Record<string, unknown>

const CONVERSATION_INSTRUCTIONS = `## Purpose
Your purpose is to assist users by answering their questions and helping them accomplish their goals.

## Behavioural Rules
- **Tone**: Friendly, clear, and professional.
- **Brevity**: Provide concise responses focused on the user's needs.
- **Formatting**: Use **bold** for key terms and bullet points for lists.
- **Interactivity**: Ask clarifying questions when the user's request is ambiguous.
- **Language**: Always answer in the language of the user's last message.

## Guardrails
- **Confidentiality**: Do not share any personal or sensitive information.
- **Ethics**: Avoid engaging in discussions that promote harm or illegal activities.`

const FORM_INSTRUCTIONS =
  "Your main task is to help the user fill out the form by asking questions and providing guidance. Ask one question at a time to fill out the form. Always answer in the language of the user's last message."

const FORM_OUTPUT_JSON_SCHEMA: OutputJsonSchema = {
  type: "object",
  properties: {
    country: { type: "string", description: "What country do you live in?" },
    language: { type: "string", description: "What is your preferred language?" },
  },
  required: ["country", "language"],
  propertyOrdering: ["country", "language"],
}

const EXTRACTION_INSTRUCTIONS = `Extract structured information from the uploaded document.

Return ONLY the JSON object that matches the provided output schema.

Rules:
- Do not add fields that are not defined in the schema.
- Use null when a required value is not present in the document.
- Keep original values as written in the document when possible.
- Do not include explanations or markdown.`

const EXTRACTION_OUTPUT_JSON_SCHEMA: OutputJsonSchema = {
  type: "object",
  properties: {
    numberOfParagraphs: {
      type: "number",
      description: "How many paragraphs do you want to extract?",
    },
    language: { type: "string", description: "What is the language of the document?" },
  },
  required: ["numberOfParagraphs", "language"],
}

/**
 * The instructions and result schema a new agent starts from when its creator gives none: the
 * studio's agent creator and the MCP create_agent tool both rely on them. A conversation agent with
 * the fillForm tool starts as a form agent.
 */
export function newAgentDefaults({
  type,
  fillFormEnabled,
}: {
  type: AgentType
  fillFormEnabled?: boolean
}): { instructions: string; outputJsonSchema: OutputJsonSchema | null } {
  if (type === "extraction") {
    return {
      instructions: EXTRACTION_INSTRUCTIONS,
      outputJsonSchema: structuredClone(EXTRACTION_OUTPUT_JSON_SCHEMA),
    }
  }
  if (fillFormEnabled) {
    return {
      instructions: FORM_INSTRUCTIONS,
      outputJsonSchema: structuredClone(FORM_OUTPUT_JSON_SCHEMA),
    }
  }
  return { instructions: CONVERSATION_INSTRUCTIONS, outputJsonSchema: null }
}
