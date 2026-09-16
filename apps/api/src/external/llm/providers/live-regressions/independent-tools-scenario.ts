import { ToolName } from "@caseai-connect/api-contracts"
import { wrapLanguageModel } from "ai"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "@/domains/agents/shared/agent-session-messages/streaming/master-promts/helpers"
import {
  inlineCitationInstruction,
  lookupKnowledgeBaseTool,
} from "@/domains/agents/shared/agent-session-messages/streaming/tools/lookup-knowledge-base.tool"
import { createRetrievedChunksRegistry } from "@/domains/agents/shared/agent-session-messages/streaming/tools/retrieved-chunks-registry"
import { surfaceResourcesTool } from "@/domains/agents/shared/agent-session-messages/streaming/tools/surface-resources.tool"
import {
  createSurfacedResourcesRegistry,
  type SurfaceableLibrary,
} from "@/domains/agents/shared/agent-session-messages/streaming/tools/surfaced-resources-registry"
import type { ToolExecutionLog } from "@/domains/agents/shared/agent-session-messages/streaming/tools/tool-execution-log"
import type { AISDKLLMProviderBase } from "@/external/llm/ai-sdk-llm-provider-base"
import { GemmaPromptHelper } from "@/external/llm/providers/gemma/gemma-prompt-helper"
import { HANDBOOK_CHUNKS } from "./employee-handbook.fixture"

/**
 * Two INDEPENDENT tools on one turn: a resource card and a knowledge base
 * lookup, both triggered by the same user message. Measures which tools
 * the model calls and how many generations the answering loop needs: two
 * when both calls come in the first generation (calls, then answer),
 * three when the model emits one call per generation.
 *
 * The `groupedCallsInstruction` switch appends a candidate master-prompt
 * line ("call independent tools in the same response") for the providers
 * that do NOT inject it themselves. MEASURED 2026-09-16, 5 runs per case,
 * temperature 0 (deterministic per case):
 * - Gemma 4: the line groups the calls on the "charge" turn (infra suites),
 *   recovers a skipped card on a French paid-leave question, neutral on the
 *   English one. ADOPTED for Gemma only: the Gemma provider injects it in
 *   the system prompt whenever several tools are declared
 *   (GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION), so on Gemma both
 *   variants of this scenario carry it.
 * - Gemini 3.1/3.6/3.7/3.8 Flash: 2 generations, both tools, with or
 *   without the line (neutral).
 * - Gemini 3.5 Flash Lite: EN 3 to 2 generations; FR, the line DROPS the
 *   card. Gemini 2.5 Flash: EN 3/3; FR, without the line NO lookup, with it
 *   both tools. Not adopted on Gemini: the effect on tool selection goes
 *   both ways depending on the message.
 */

/** Candidate line for the providers that do not inject it (see the header). */
export const GROUPED_CALLS_LINE = GemmaPromptHelper.GROUPED_TOOL_CALLS_INSTRUCTION

const connectScope = { organizationId: "org-1", projectId: "project-1" }

const LEAVE_POLICY_LIBRARY: SurfaceableLibrary = {
  id: "library-1",
  organizationId: connectScope.organizationId,
  projectId: connectScope.projectId,
  title: "Guides",
  resources: [
    {
      id: "resource-1",
      title: "Leave request guide",
      description: "Step-by-step guide to request paid leave in the HR portal",
      matchingHints: "When asking about paid leave, days off, vacation",
    } as SurfaceableLibrary["resources"][number],
    {
      id: "resource-2",
      title: "Expense policy",
      description: "How to submit expenses",
      matchingHints: "When asking about expenses or reimbursements",
    } as SurfaceableLibrary["resources"][number],
  ],
}

/**
 * Counts the generations a provider makes, by wrapping the language model
 * it builds. Instance-level override: the provider classes expose
 * getLanguageModel publicly, and the base class calls it through `this`.
 */
export function withGenerationCounter(provider: LLMProvider): {
  provider: LLMProvider
  generations: () => number
  /** Per generation, the tools whose RESULTS were already in its prompt. */
  toolResultsSeen: () => string[][]
} {
  const seen: string[][] = []
  const base = provider as AISDKLLMProviderBase
  const original = base.getLanguageModel.bind(base)
  const recordGeneration = (params: { prompt: unknown }) => {
    const prompt = Array.isArray(params.prompt) ? params.prompt : []
    const toolNames: string[] = []
    for (const message of prompt as Array<{ role: string; content: unknown }>) {
      if (message.role !== "tool" || !Array.isArray(message.content)) continue
      for (const part of message.content as Array<{ type: string; toolName?: string }>) {
        if (part.type === "tool-result" && part.toolName) toolNames.push(part.toolName)
      }
    }
    seen.push(toolNames)
  }
  base.getLanguageModel = (args) =>
    wrapLanguageModel({
      model: original(args),
      middleware: {
        specificationVersion: "v3",
        wrapStream: async ({ doStream, params }) => {
          recordGeneration(params)
          return doStream()
        },
        wrapGenerate: async ({ doGenerate, params }) => {
          recordGeneration(params)
          return doGenerate()
        },
      },
    })
  return { provider, generations: () => seen.length, toolResultsSeen: () => seen }
}

export async function runIndependentToolsScenario({
  provider,
  model,
  groupedCallsInstruction,
  userMessage = "hi, how many days of paid leave do I get?",
}: {
  provider: LLMProvider
  model: string
  /** Append the candidate grouped-calls line (measurement only). */
  groupedCallsInstruction: boolean
  /** Defaults to an English paid-leave question; the measurement varies it. */
  userMessage?: string
}): Promise<{
  text: string
  toolExecutions: ToolExecutionLog[]
  generations: number
  /** Per generation, the tool results already in its prompt (reveals the call sequence). */
  toolResultsSeen: string[][]
}> {
  const toolExecutions: ToolExecutionLog[] = []
  const onExecute = (toolExecution: ToolExecutionLog) => {
    toolExecutions.push(toolExecution)
  }
  const retrievedChunksRegistry = createRetrievedChunksRegistry()
  const tools = {
    [ToolName.LookupKnowledgeBase]: lookupKnowledgeBaseTool({
      connectScope,
      retrievalService: { retrieveTopChunks: async () => HANDBOOK_CHUNKS } as never,
      retrievedChunksRegistry,
      citeInline: true,
      onExecute,
    }),
    [ToolName.SurfaceResources]: surfaceResourcesTool({
      surfacedResourcesRegistry: createSurfacedResourcesRegistry([LEAVE_POLICY_LIBRARY]),
      onExecute,
    }),
  }

  // Production master-prompt layout (see conversation-agent.prompt.ts),
  // with the tools section generated by the production helper. The switch
  // appends the candidate line right after it.
  const toolsSection = `${promptHelpers.tools({
    agentSettings: {} as AgentSettings,
    names: Object.keys(tools),
    descriptions: { [ToolName.LookupKnowledgeBase]: inlineCitationInstruction() },
  })}${groupedCallsInstruction ? `\n\n${GROUPED_CALLS_LINE}` : ""}`
  const systemPrompt = `## Purpose
Your purpose is to assist users by answering their questions about the company employee handbook, always refer to your knowledge base.

${promptHelpers.resourceLibraries([LEAVE_POLICY_LIBRARY])}

${toolsSection}

## Response language:
Always answer in English.

${promptHelpers.now()}`

  const metadata: LLMMetadata = {
    traceId: `live-regression-independent-tools-${model}`,
    agentSessionId: "live-regression-independent-tools-session",
    currentTurn: 1,
    organizationId: connectScope.organizationId,
    agentId: "agent-1",
    revision: 1,
    projectId: connectScope.projectId,
    tags: ["live-provider-regressions", "independent-tools", model],
  }

  const counted = withGenerationCounter(provider)
  const chunks = counted.provider.streamChatResponse({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "assistant", content: "Hello! Ask me anything about the employee handbook." },
      { role: "user", content: userMessage },
    ],
    config: {
      model,
      temperature: 0,
      tools,
      fireAndForgetToolNames: [ToolName.SurfaceResources],
      serviceTier: undefined,
    },
    metadata,
  })
  let text = ""
  for await (const chunk of chunks) text += chunk
  return {
    text,
    toolExecutions,
    generations: counted.generations(),
    toolResultsSeen: counted.toolResultsSeen(),
  }
}
