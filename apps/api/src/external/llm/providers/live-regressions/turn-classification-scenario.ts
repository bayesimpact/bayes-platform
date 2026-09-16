import { ToolName } from "@caseai-connect/api-contracts"
import type {
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { createInlineCitationExtractor } from "@/domains/agents/shared/agent-session-messages/streaming/tools/inline-citations"
import {
  inlineCitationInstruction,
  lookupKnowledgeBaseInstruction,
  lookupKnowledgeBaseTool,
} from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import { createRetrievedChunksRegistry } from "@/domains/agents/shared/agent-session-messages/streaming/tools/retrieved-chunks-registry"
import type { ToolExecutionLog } from "@/domains/agents/shared/agent-session-messages/streaming/tools/tool-execution-log"
import {
  runTurnClassification,
  type SessionMetadataRecalculator,
} from "@/domains/agents/shared/agent-session-messages/streaming/tools/turn-classification"
import { HANDBOOK_CHUNKS } from "./employee-handbook.fixture"
import { buildFatSystemPrompt } from "./fat-prompt.fixture"

export const HANDBOOK_DOCUMENT_ID = "b7a3f1c2-8d4e-4a91-b2c5-6e7f8a9d0c1b"
export const HANDBOOK_CATEGORY_NAMES = ["HR", "IT", "Other"]
export const FAT_AGENT_CATEGORY_NAMES = [
  "Mobility",
  "Training",
  "Allowances",
  "Account",
  "Out of scope",
]

export type TurnScenarioResult = {
  /** The user-visible reply (inline citations already stripped). */
  text: string
  /** The aliases the model cited inline, if any. */
  citedAliases: string[]
  /** Everything the turn logged (Sources, RecalculateConversationSessionMetadata, lookup). */
  toolExecutions: ToolExecutionLog[]
}

const connectScope = { organizationId: "org-1", projectId: "project-1" }

const passthroughRecalculator: SessionMetadataRecalculator = {
  recalculateSessionMetadataFromMessages: async ({ selectedCategoryNames, suggestedTitle }) => ({
    suggestedTitle,
    selectedCategoryNames,
  }),
}

function buildConfig(model: string): (systemPrompt: string) => LLMConfig {
  return (systemPrompt) => ({ model, temperature: 0, systemPrompt, serviceTier: undefined })
}

function buildMetadata({ model, scenario }: { model: string; scenario: string }): LLMMetadata {
  return {
    traceId: `live-regression-${scenario}-${model}`,
    agentSessionId: `live-regression-${scenario}-session`,
    currentTurn: 1,
    organizationId: "org-1",
    agentId: "agent-1",
    revision: 1,
    projectId: "project-1",
    tags: ["live-provider-regressions", scenario, model],
  }
}

/**
 * Provider-agnostic production-shaped RAG turn through the FULL pipeline:
 * the real lookup tool (production description, inline citation rule) over a
 * realistic top-20 retrieval on a fictional employee handbook, the stream
 * citation extractor, then the post-turn classification (title, categories,
 * and the sources fallback when nothing was cited inline).
 */
export async function runRagTurnScenario({
  provider,
  model,
  userMessage = "how many days of paid leave am I entitled to?",
}: {
  provider: LLMProvider
  model: string
  userMessage?: string
}): Promise<TurnScenarioResult> {
  const registry = createRetrievedChunksRegistry()
  const toolExecutions: ToolExecutionLog[] = []
  const onExecute = (toolExecution: ToolExecutionLog) => {
    toolExecutions.push(toolExecution)
  }

  const lookupTool = lookupKnowledgeBaseTool({
    connectScope,
    retrievalService: { retrieveTopChunks: async () => HANDBOOK_CHUNKS } as never,
    retrievedChunksRegistry: registry,
    citeInline: true,
    onExecute,
  })

  // Mirrors the production master-prompt layout for a RAG agent that
  // reports sources: the lookup line carries the citation rule.
  const systemPrompt = `## Purpose
Your purpose is to assist users by answering their questions about the company employee handbook, always refer to your knowledge base.

## Tools:
[${ToolName.LookupKnowledgeBase}]: ${lookupKnowledgeBaseInstruction()} ${inlineCitationInstruction()}

## Response language:
Always answer in English.`

  const metadata = buildMetadata({ model, scenario: "rag" })
  const chunks = provider.streamChatResponse({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    config: {
      model,
      temperature: 0,
      tools: { [ToolName.LookupKnowledgeBase]: lookupTool },
      serviceTier: undefined,
    },
    metadata,
  })

  const citations = createInlineCitationExtractor()
  let text = ""
  for await (const chunk of chunks) text += citations.feed(chunk)
  text += citations.flush()

  await runTurnClassification({
    context: {
      retrievedChunksRegistry: registry,
      sessionMetadata: {
        connectScope,
        sessionId: "session-1",
        availableCategoryNames: HANDBOOK_CATEGORY_NAMES,
        metadataRecalculator: passthroughRecalculator,
      },
      onExecute,
    },
    provider,
    buildConfig: buildConfig(model),
    metadata,
    earlierMessages: [],
    userMessage,
    answerText: text,
    citedChunkAliases: citations.citedAliases(),
  })

  return { text, citedAliases: citations.citedAliases(), toolExecutions }
}

/**
 * No-RAG production-shaped turn: an agent whose whole referential lives in a
 * ~9k-token system prompt (no lookup tool at all), with strict guardrails.
 * The answering call carries no tool; the post-turn classification produces
 * the title and categories on its own.
 */
export async function runFatPromptTurnScenario({
  provider,
  model,
  userMessage,
}: {
  provider: LLMProvider
  model: string
  userMessage: string
}): Promise<TurnScenarioResult> {
  const toolExecutions: ToolExecutionLog[] = []
  const onExecute = (toolExecution: ToolExecutionLog) => {
    toolExecutions.push(toolExecution)
  }

  const metadata = buildMetadata({ model, scenario: "fat-prompt" })
  const earlierMessages = [
    {
      role: "assistant" as const,
      content: "Hello! I am your virtual assistant. How can I help you today?",
    },
  ]
  const chunks = provider.streamChatResponse({
    messages: [
      { role: "system", content: buildFatSystemPrompt({ toolsSection: "" }) },
      ...earlierMessages,
      { role: "user", content: userMessage },
    ],
    config: { model, temperature: 0, serviceTier: undefined },
    metadata,
  })

  let text = ""
  for await (const chunk of chunks) text += chunk

  await runTurnClassification({
    context: {
      sessionMetadata: {
        connectScope,
        sessionId: "session-1",
        availableCategoryNames: FAT_AGENT_CATEGORY_NAMES,
        metadataRecalculator: passthroughRecalculator,
      },
      onExecute,
    },
    provider,
    buildConfig: buildConfig(model),
    metadata,
    earlierMessages,
    userMessage,
    answerText: text,
    citedChunkAliases: [],
  })

  return { text, citedAliases: [], toolExecutions }
}
