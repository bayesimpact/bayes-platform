import { ToolName } from "@caseai-connect/api-contracts"
import { Logger } from "@nestjs/common"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import type { OnExecute } from "../streaming-session.types"
import type { RetrievedChunksRegistry } from "./retrieved-chunks-registry"

/**
 * Post-turn classification.
 *
 * Everything the platform needs to know ABOUT a reply, as opposed to what
 * the model needs to produce it, is computed after the reply by one
 * dedicated structured-output call: the session title, the session
 * categories and, when the model did not cite its sources inline, the
 * retrieved passages the reply relies on. None of this is a tool in the
 * answering loop any more (see ADR 0016): the answering model only carries
 * tools that interact with the conversation.
 *
 * The call reads a SHORT prompt of its own (the latest exchange, a few
 * earlier messages for context, the category list, the passage excerpts),
 * not the agent's system prompt, and runs at temperature 0 with the schema
 * enforced by the provider's structured-output mode. It is best-effort: the
 * user already has the reply, so a failure is logged loudly and never
 * breaks the stream.
 *
 * The results are logged under the historical tool names (Sources,
 * RecalculateConversationSessionMetadata) so persisted tool calls, the
 * activity timeline and the sources panel are unchanged.
 */

/**
 * Cap on the chunk excerpt stored in the tool-call log (and shown in the
 * sources panel). Parent chunks can be several thousand characters; the
 * panel only needs enough to identify the passage.
 */
const MAX_PARTIAL_CONTENT_LENGTH = 500
/** Passage excerpt shown to the classifier when it has to attribute sources. */
const MAX_CLASSIFIER_EXCERPT_LENGTH = 700
/** Earlier messages given to the classifier as context, and their size. */
const MAX_CONTEXT_MESSAGES = 6
const MAX_CONTEXT_MESSAGE_LENGTH = 600
const MAX_TITLE_LENGTH = 120
const MAX_CATEGORIES = 5

const logger = new Logger("TurnClassification")

/**
 * Persists the reported title/categories on the session. Two
 * implementations: ConversationAgentSessionsService (studio/app sessions)
 * and PublicAgentSessionsService (embed sessions) — same semantics, keyed
 * on their own session table.
 */
export type SessionMetadataRecalculator = {
  recalculateSessionMetadataFromMessages(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    selectedCategoryNames: string[]
    suggestedTitle: string | null
  }): Promise<{ suggestedTitle: string | null; selectedCategoryNames: string[] }>
}

export type SessionMetadataConfig = {
  connectScope: RequiredConnectScope
  sessionId: string
  availableCategoryNames: string[]
  metadataRecalculator: SessionMetadataRecalculator
}

/**
 * What the turn-building step hands over to the post-turn step. Built by
 * ToolsService together with the tools, since both share the chunks
 * registry the lookup tool writes into.
 */
/**
 * Present when the reply comes from a sub-agent in control of the conversation
 * (handoff). The classifier then also says whether the sub-agent's part is
 * over, and summarizes it for the agent that resumes. A conclusion the
 * sub-agent already signaled with its tool is not repeated; a conclusion it
 * forgot to signal is applied from the classifier's reading of the reply.
 */
export type HandoffClassificationConfig = {
  childAgentName: string
  parentAgentName: string
  /** True when the sub-agent called concludeHandoff during this turn. */
  concludedByTool: () => boolean
  /** Applies the conclusion (active agent cleared, form concluded with the summary). */
  conclude: (params: { summary: string; detectedByClassifier: boolean }) => Promise<void>
}

export type TurnClassificationContext = {
  /** Present when the sources feature is enabled for the project and the agent retrieves. */
  retrievedChunksRegistry?: RetrievedChunksRegistry
  /** Present for every conversation agent with a session to update (title; categories when configured). */
  sessionMetadata?: SessionMetadataConfig
  /** Present when the replying agent is a sub-agent in control of the conversation. */
  handoff?: HandoffClassificationConfig
  onExecute: OnExecute
}

type ResolvedSource = {
  documentId: string
  documentTitle?: string
  documentSourceType?: string
  chunks: { chunkId: string; partialContent: string }[]
}

/**
 * Groups the cited chunks by document, in the legacy `sources` shape the
 * persistence layer and the sources panel already consume.
 */
export function resolveSources({
  chunkAliases,
  retrievedChunksRegistry,
}: {
  chunkAliases: string[]
  retrievedChunksRegistry: RetrievedChunksRegistry
}): { sources: ResolvedSource[]; unknownChunkIds: string[] } {
  const sourcesByDocumentId = new Map<string, ResolvedSource>()
  const unknownChunkIds: string[] = []

  for (const chunkAlias of [...new Set(chunkAliases)]) {
    const chunk = retrievedChunksRegistry.get(chunkAlias)
    if (!chunk) {
      unknownChunkIds.push(chunkAlias)
      continue
    }
    const source = sourcesByDocumentId.get(chunk.documentId) ?? {
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      documentSourceType: chunk.documentSourceType,
      chunks: [],
    }
    source.chunks.push({
      chunkId: chunk.chunkId,
      partialContent:
        chunk.content.length > MAX_PARTIAL_CONTENT_LENGTH
          ? `${chunk.content.slice(0, MAX_PARTIAL_CONTENT_LENGTH)}…`
          : chunk.content,
    })
    sourcesByDocumentId.set(chunk.documentId, source)
  }

  return { sources: [...sourcesByDocumentId.values()], unknownChunkIds }
}

/**
 * Logs the cited chunks as a Sources tool call. Returns false when nothing
 * resolved (no alias, or only unknown ones): an empty sources entry would
 * show an empty panel for nothing.
 */
async function dispatchSources({
  chunkAliases,
  retrievedChunksRegistry,
  onExecute,
}: {
  chunkAliases: string[]
  retrievedChunksRegistry: RetrievedChunksRegistry
  onExecute: OnExecute
}): Promise<boolean> {
  if (chunkAliases.length === 0) return false
  const { sources, unknownChunkIds } = resolveSources({ chunkAliases, retrievedChunksRegistry })
  if (sources.length === 0) {
    logger.warn(`cited chunk ids resolved to nothing: ${JSON.stringify(unknownChunkIds)}`)
    return false
  }
  await onExecute({
    toolName: ToolName.Sources,
    arguments: { sources, ...(unknownChunkIds.length > 0 ? { unknownChunkIds } : {}) },
  })
  return true
}

/**
 * The classifier's output schema, as JSON schema for the provider's
 * structured-output mode. Only the fields the turn needs are declared:
 * categories when the agent has some, chunkIds when passages were retrieved
 * and not cited inline. Enums carry the closed lists so a constrained
 * decoder cannot produce an unknown value.
 */
export function buildTurnClassificationSchema({
  availableCategoryNames,
  chunkAliases,
  handoff = false,
}: {
  availableCategoryNames: string[]
  chunkAliases: string[]
  /** Adds the hand-over fields (task concluded, summary). */
  handoff?: boolean
}): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    suggestedTitle: {
      type: ["string", "null"],
      description:
        "A concise title for the whole conversation, in its language, under 80 characters. null when there is nothing to name yet (a greeting alone).",
    },
  }
  if (availableCategoryNames.length > 0) {
    properties.categoryNames = {
      type: "array",
      items: { type: "string", enum: availableCategoryNames },
      maxItems: MAX_CATEGORIES,
      description:
        "The complete set of categories that apply to the conversation as a whole, including earlier turns. Empty when none applies.",
    }
  }
  if (chunkAliases.length > 0) {
    properties.chunkIds = {
      type: "array",
      items: { type: "string", enum: chunkAliases },
      description:
        "The ids of every retrieved passage the reply actually relies on. Empty when the reply does not use them.",
    }
  }
  if (handoff) {
    properties.taskConcluded = {
      type: "boolean",
      description:
        "true when the reply ends the sub-agent's part: it gives its conclusion, says it has everything it needs, or says goodbye with nothing further to ask. false when it still asks the user something or waits for an answer.",
    }
    properties.handoffSummary = {
      type: "string",
      description:
        "Two to four sentences, in the conversation's language, on what the sub-agent collected or answered during its whole part of the conversation, for the agent that resumes. Facts the user stated only; no advice.",
    }
  }
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

// Lenient application-side barrier: the provider enforces the shape, this
// only guards the dispatch (a bad title must not throw away good categories).
const turnClassificationOutputSchema = z.object({
  suggestedTitle: z
    .string()
    .trim()
    .transform((title) => title.slice(0, MAX_TITLE_LENGTH))
    .nullable()
    .optional(),
  categoryNames: z.array(z.string()).optional(),
  chunkIds: z.array(z.string()).optional(),
  taskConcluded: z.boolean().optional(),
  handoffSummary: z.string().trim().optional(),
})

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

/** The text of an LLM message (attachment parts, if any, are dropped). */
export function llmMessageText(message: LLMChatMessage): string {
  if (typeof message.content === "string") return message.content
  if (!Array.isArray(message.content)) return ""
  return message.content
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n")
}

export function buildTurnClassificationPrompt({
  earlierMessages,
  userMessage,
  answerText,
  availableCategoryNames,
  passages,
  handoff,
}: {
  /** LLM-visible history BEFORE the latest user message. */
  earlierMessages: LLMChatMessage[]
  userMessage: string
  answerText: string
  availableCategoryNames: string[]
  passages: Array<{ alias: string; documentTitle: string; content: string }>
  handoff?: Pick<HandoffClassificationConfig, "childAgentName" | "parentAgentName">
}): { systemPrompt: string; userContent: string } {
  const systemPrompt = [
    "You are a classifier working behind a conversational assistant. You read one exchange between a user and the assistant and return a structured report about it.",
    "You never write to the user. Base the report ONLY on the exchange shown; do not add information.",
  ].join(" ")

  const sections: string[] = []
  const context = earlierMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(
      (message) =>
        `${message.role}: ${truncate(llmMessageText(message), MAX_CONTEXT_MESSAGE_LENGTH)}`,
    )
  if (context.length > 0) {
    sections.push(`## Earlier conversation (context only)\n${context.join("\n")}`)
  }
  sections.push(`## Latest user message\n${userMessage}`)
  sections.push(`## Assistant reply\n${answerText}`)
  sections.push(
    "## Title\nSuggest a concise title for the whole conversation, in its language. Return null when the conversation is only a greeting or contains nothing to name yet.",
  )
  if (availableCategoryNames.length > 0) {
    sections.push(
      `## Categories\nAvailable categories: ${availableCategoryNames.join(", ")}.\nReturn the complete set of categories that apply to the conversation as a whole (earlier turns included), at most ${MAX_CATEGORIES}. Return an empty array when none applies.`,
    )
  }
  if (passages.length > 0) {
    const passageLines = passages
      .map(
        (passage) =>
          `- ${passage.alias} (${passage.documentTitle}): ${truncate(passage.content, MAX_CLASSIFIER_EXCERPT_LENGTH)}`,
      )
      .join("\n")
    sections.push(
      `## Retrieved passages\nThe assistant retrieved these passages before replying. Return the ids of every passage the reply actually relies on. Return an empty array when the reply does not use them (for example when it says the information was not found).\n${passageLines}`,
    )
  }
  if (handoff) {
    sections.push(
      `## Hand-over\nThe assistant is "${handoff.childAgentName}", a sub-agent that took the conversation over from "${handoff.parentAgentName}" for one part of it. Say whether this reply ENDS its part (taskConcluded): a conclusion, a statement that it has everything it needs, or a goodbye with nothing further to ask. A reply that still asks the user something is not a conclusion. Then summarize, in two to four sentences and in the conversation's language, what "${handoff.childAgentName}" collected or answered during its whole part, for "${handoff.parentAgentName}" (handoffSummary). Facts the user stated only.`,
    )
  }
  return { systemPrompt, userContent: sections.join("\n\n") }
}

/**
 * Runs the post-turn step: dispatches the inline citations, then makes the
 * classification call for whatever is still missing (title/categories, and
 * sources when nothing was cited inline). Never throws.
 */
export async function runTurnClassification({
  context,
  provider,
  buildConfig,
  metadata,
  earlierMessages,
  userMessage,
  answerText,
  citedChunkAliases,
}: {
  context: TurnClassificationContext
  provider: LLMProvider
  /** Builds the LLM config for the classification call from its system prompt. */
  buildConfig: (systemPrompt: string) => LLMConfig
  metadata: LLMMetadata
  earlierMessages: LLMChatMessage[]
  userMessage: string
  answerText: string
  /** Aliases cited inline in the reply (already stripped from the text). */
  citedChunkAliases: string[]
}): Promise<void> {
  const { retrievedChunksRegistry, sessionMetadata, handoff, onExecute } = context
  try {
    let sourcesDispatched = false
    if (retrievedChunksRegistry && citedChunkAliases.length > 0) {
      sourcesDispatched = await dispatchSources({
        chunkAliases: citedChunkAliases,
        retrievedChunksRegistry,
        onExecute,
      })
    }

    // Sources only need the classifier when passages were retrieved and the
    // reply cited none of them inline.
    const needsSources = retrievedChunksRegistry?.hasChunks() && !sourcesDispatched
    if (!needsSources && !sessionMetadata && !handoff) return

    const passages = needsSources
      ? (retrievedChunksRegistry?.entries() ?? []).map(({ alias, chunk }) => ({
          alias,
          documentTitle: chunk.documentTitle,
          content: chunk.content,
        }))
      : []
    const availableCategoryNames = sessionMetadata?.availableCategoryNames ?? []
    const { systemPrompt, userContent } = buildTurnClassificationPrompt({
      earlierMessages,
      userMessage,
      answerText,
      availableCategoryNames,
      passages,
      handoff,
    })
    const schema = buildTurnClassificationSchema({
      availableCategoryNames,
      chunkAliases: passages.map((passage) => passage.alias),
      handoff: handoff !== undefined,
    })

    const rawOutput = await provider.generateStructuredOutput({
      message: { role: "user", content: userContent },
      schema,
      config: buildConfig(systemPrompt),
      metadata: {
        ...metadata,
        tags: [...metadata.tags, "turn-classification"],
        spanLabel: metadata.spanLabel ? `${metadata.spanLabel} · classification` : "classification",
      },
    })
    const parsed = turnClassificationOutputSchema.safeParse(rawOutput)
    if (!parsed.success) {
      logger.error(
        `classification output rejected: ${parsed.error.message} (output: ${JSON.stringify(rawOutput)})`,
      )
      return
    }

    if (needsSources && retrievedChunksRegistry) {
      await dispatchSources({
        chunkAliases: parsed.data.chunkIds ?? [],
        retrievedChunksRegistry,
        onExecute,
      })
    }

    if (handoff) {
      const concludedByTool = handoff.concludedByTool()
      if (concludedByTool || parsed.data.taskConcluded) {
        await handoff.conclude({
          summary: parsed.data.handoffSummary ?? "",
          detectedByClassifier: !concludedByTool,
        })
      }
    }

    if (sessionMetadata) {
      const { suggestedTitle, selectedCategoryNames } =
        await sessionMetadata.metadataRecalculator.recalculateSessionMetadataFromMessages({
          connectScope: sessionMetadata.connectScope,
          sessionId: sessionMetadata.sessionId,
          selectedCategoryNames: parsed.data.categoryNames ?? [],
          suggestedTitle: parsed.data.suggestedTitle ?? null,
        })
      await onExecute({
        toolName: ToolName.RecalculateConversationSessionMetadata,
        arguments: { suggestedTitle, categoryNames: selectedCategoryNames },
      })
    }
  } catch (error) {
    logger.error(
      `turn classification failed (agent ${metadata.agentId}, session ${metadata.agentSessionId}): ${error instanceof Error ? error.message : error}`,
    )
  }
}
