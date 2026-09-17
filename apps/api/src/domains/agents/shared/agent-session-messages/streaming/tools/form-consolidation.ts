import {
  getOrderedPropertyEntries,
  type OutputJsonSchemaProperty,
  type outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { Logger } from "@nestjs/common"
import type { z } from "zod"
import type {
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { castToolInputParameters } from "@/common/zod-helper"

/**
 * Form consolidation at the end of a hand-over.
 *
 * During the interview the fillForm tool depends on the model: it sometimes
 * forgets to record an answer, or records one field when the answer covered
 * two. Forcing the tool on every turn makes the model invent values; reading
 * the whole exchange again catches the gaps better. So the exchange is read
 * once, when the sub-agent concludes: one structured extraction over the
 * sub-agent's part of the transcript, with the form schema, at temperature 0,
 * under a strict rule (only what the user stated, null otherwise). It only
 * ADDS the fields still empty in the form; a value written by fillForm during
 * the exchange is never overwritten, whatever the extraction says.
 */

const logger = new Logger("FormConsolidation")
const MAX_TRANSCRIPT_MESSAGE_LENGTH = 1500

export type TranscriptMessage = {
  role: "user" | "assistant"
  content: string
  /** The agent that wrote an assistant message. */
  agentId?: string
}

type OutputJsonSchema = z.infer<typeof outputJsonSchemaSchema>

/**
 * The sub-agent's part of the transcript: from its first reply to the end,
 * with the user's messages in between. Earlier messages belong to the parent
 * and are not read again here (what the parent collected has its own form).
 */
export function handoffTranscriptWindow(
  messages: TranscriptMessage[],
  childAgentId: string,
): TranscriptMessage[] {
  const firstChildReply = messages.findIndex(
    (message) => message.role === "assistant" && message.agentId === childAgentId,
  )
  if (firstChildReply === -1) return []
  // The user message that the sub-agent's first reply answers is part of its part.
  const start =
    firstChildReply > 0 && messages[firstChildReply - 1]?.role === "user"
      ? firstChildReply - 1
      : firstChildReply
  return messages
    .slice(start)
    .filter((message) => message.role === "user" || message.agentId === childAgentId)
}

/**
 * The extraction schema: every form field, each nullable, nothing required
 * but the keys, so the provider's structured-output mode returns one value
 * or null per field.
 */
export function buildConsolidationSchema(schema: OutputJsonSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const [key, property] of getOrderedPropertyEntries(schema)) {
    properties[key] = nullableProperty(property)
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

function nullableProperty(property: OutputJsonSchemaProperty): Record<string, unknown> {
  const description = property.description ? { description: property.description } : {}
  switch (property.type) {
    case "string":
      return {
        type: ["string", "null"],
        ...(property.enum && property.enum.length > 0 ? { enum: [...property.enum, null] } : {}),
        ...description,
      }
    case "number":
      return { type: ["number", "null"], ...description }
    case "boolean":
      return { type: ["boolean", "null"], ...description }
    case "array":
      return {
        type: ["array", "null"],
        items: property.items ? nullableItem(property.items) : { type: "string" },
        ...description,
      }
    case "object":
      return { type: ["object", "null"], ...description }
  }
}

function nullableItem(items: OutputJsonSchemaProperty): Record<string, unknown> {
  switch (items.type) {
    case "number":
      return { type: "number" }
    case "boolean":
      return { type: "boolean" }
    case "object":
      return { type: "object" }
    case "array":
      return { type: "array", items: items.items ? nullableItem(items.items) : { type: "string" } }
    default:
      return { type: "string" }
  }
}

export function buildConsolidationPrompt({
  transcript,
  schema,
  agentName,
}: {
  transcript: TranscriptMessage[]
  schema: OutputJsonSchema
  agentName: string
}): { systemPrompt: string; userContent: string } {
  const systemPrompt = [
    "You extract form values from a conversation transcript. You never write to the user.",
    "Return, for each field, the value the user explicitly stated in the transcript, in the user's own terms, or null when the user did not state it.",
    "Never infer, guess, complete or normalize beyond what was said. A question the assistant asked without an answer is null. Advice or statements by the assistant are not values.",
  ].join(" ")
  const fieldLines = getOrderedPropertyEntries(schema)
    .map(([key, property]) => {
      const hints: string[] = []
      if (property.enum && property.enum.length > 0)
        hints.push(`one of: ${property.enum.join(", ")}`)
      return `- ${key}: ${property.description ?? "No description"}${hints.length > 0 ? ` (${hints.join("; ")})` : ""}`
    })
    .join("\n")
  const transcriptLines = transcript
    .map((message) => {
      const speaker = message.role === "user" ? "user" : agentName
      const content =
        message.content.length > MAX_TRANSCRIPT_MESSAGE_LENGTH
          ? `${message.content.slice(0, MAX_TRANSCRIPT_MESSAGE_LENGTH)}…`
          : message.content
      return `${speaker}: ${content}`
    })
    .join("\n")
  return {
    systemPrompt,
    userContent: `## Fields\n${fieldLines}\n\n## Transcript\n${transcriptLines}`,
  }
}

/** True for a form value that counts as not collected. */
export function isEmptyFormValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === "" || value.trim().toLowerCase() === "null"
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * The fields to add: extracted with a value, still empty in the form. A field
 * the exchange already filled keeps its value, whatever the extraction says.
 */
export function pickMissingFields({
  state,
  extracted,
}: {
  state: Record<string, unknown>
  extracted: Record<string, unknown>
}): Record<string, unknown> {
  const candidates = castToolInputParameters(extracted)
  const added: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(candidates)) {
    if (isEmptyFormValue(value)) continue
    if (!isEmptyFormValue(state[key])) continue
    added[key] = value
  }
  return added
}

/**
 * Runs the extraction and returns the fields to add. Best-effort: the
 * hand-over is already concluded, a failure here is logged and adds nothing.
 */
export async function runFormConsolidation({
  provider,
  buildConfig,
  metadata,
  schema,
  transcript,
  state,
  agentName,
}: {
  provider: LLMProvider
  buildConfig: (systemPrompt: string) => LLMConfig
  metadata: LLMMetadata
  schema: OutputJsonSchema
  transcript: TranscriptMessage[]
  state: Record<string, unknown>
  agentName: string
}): Promise<Record<string, unknown>> {
  if (transcript.length === 0) return {}
  const missingKeys = getOrderedPropertyEntries(schema)
    .map(([key]) => key)
    .filter((key) => isEmptyFormValue(state[key]))
  if (missingKeys.length === 0) return {}
  try {
    const { systemPrompt, userContent } = buildConsolidationPrompt({
      transcript,
      schema,
      agentName,
    })
    const extracted = await provider.generateStructuredOutput({
      message: { role: "user", content: userContent },
      schema: buildConsolidationSchema(schema),
      config: buildConfig(systemPrompt),
      metadata: {
        ...metadata,
        tags: [...metadata.tags, "form-consolidation"],
        spanLabel: metadata.spanLabel ? `${metadata.spanLabel} · consolidation` : "consolidation",
      },
    })
    return pickMissingFields({ state, extracted })
  } catch (error) {
    logger.error(
      `form consolidation failed (agent ${metadata.agentId}, session ${metadata.agentSessionId}): ${error instanceof Error ? error.message : error}`,
    )
    return {}
  }
}
