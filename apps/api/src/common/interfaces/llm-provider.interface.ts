import type { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { ModelMessage, ToolSet } from "ai"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
export type LLMChatMessage = ModelMessage

type MockModels = AgentModel._Mock

export type MockValue =
  | { type: "text"; value: string }
  | { type: "object"; value: unknown }
  | { type: "stream"; chunks: string[] }
  | { type: "toolCall"; toolName: string; input: unknown }
  // A production-shaped generation: text answer followed by a tool call in
  // the SAME generation (what Gemma emits for fire-and-forget tools).
  | { type: "textWithToolCall"; text: string; toolName: string; input: unknown }
  // A generation that fails at the provider (e.g. a 400 APICallError).
  | { type: "error"; error: Error }

export type LLMFeatures = {
  priorityCalls?: boolean
  flexWorkers?: boolean
}
export type BuildLLMConfigParams = {
  model: AgentSettings["model"]
  systemPrompt: string
  temperature: AgentSettings["temperature"]
  tools?: ToolSet
  fireAndForgetToolNames?: string[]
  endOfTurnTools?: ToolSet
  endOfTurnExecutionCounts?: (toolResult: { toolName: string; output: unknown }) => boolean
  priorityCallsEnabled: boolean
  llmFeatures: LLMFeatures
  useExtendedTimeouts?: boolean
}
export type LLMConfig =
  | {
      model: MockModels
      temperature: number
      systemPrompt?: string
      tools?: ToolSet
      fireAndForgetToolNames?: string[]
      endOfTurnTools?: ToolSet
      endOfTurnExecutionCounts?: (toolResult: { toolName: string; output: unknown }) => boolean
      useExtendedTimeouts?: never
      serviceTier: never
    }
  | {
      model: Exclude<string, MockModels>
      temperature: number
      systemPrompt?: string
      tools?: ToolSet
      /**
       * Names of tools in {@link tools} whose output the model never needs
       * (logging-style tools such as sources). When a tool-loop step only
       * invokes these, the loop stops instead of running another generation.
       */
      fireAndForgetToolNames?: string[]
      /**
       * Tools invoked by a forced generation (toolChoice "required") after
       * the tool loop completes, on EVERY turn (e.g. the mandatory_tool
       * bookkeeping). Kept out of {@link tools} so the answering loop never
       * depends on the model volunteering the call.
       */
      endOfTurnTools?: ToolSet
      /**
       * Decides whether a loop execution of an end-of-turn tool satisfies
       * the guarantee. Lets the tool declare an execution STALE after the
       * fact (e.g. a turn summary submitted before the knowledge base call
       * cannot have cited sources) so the forced retry still runs. Default:
       * every execution counts.
       */
      endOfTurnExecutionCounts?: (toolResult: { toolName: string; output: unknown }) => boolean
      /**
       * Opt in to the extended network timeouts on the underlying provider fetch
       * (see {@link AISDKVertexProvider}). Reserved for long-running calls such as
       * extraction agent runs; defaults to the provider's standard timeouts.
       */
      useExtendedTimeouts?: boolean
      serviceTier: LLMServiceTier
    }
export type LLMServiceTier = "priority" | "flex" | undefined
export type LLMMetadata = (
  | {
      evaluationReportId?: never
      agentSessionId: string
      currentTurn: number
    }
  | {
      evaluationReportId: string
      agentSessionId?: never
      currentTurn?: never
    }
) & {
  traceId: string
  organizationId: string
  agentId: string
  revision: number
  projectId: string
  tags: string[]
  /**
   * Overrides the langfuse session id (which otherwise derives from
   * `agentSessionId`). Sub-agents set this to the parent session id so their
   * dedicated traces group under the same langfuse session as the parent run.
   */
  langfuseSessionId?: string
}

export interface LLMProvider {
  getAgentProvider(): AgentProvider
  streamChatResponse({
    messages,
    config,
    metadata,
  }: {
    messages: LLMChatMessage[]
    config: LLMConfig
    metadata: LLMMetadata
  }): AsyncGenerator<string, void, unknown>

  generateText({
    prompt,
    config,
    metadata,
  }: {
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string>

  generateStructuredOutput(params: {
    message: LLMChatMessage
    schema: Record<string, unknown>
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<Record<string, unknown>>
}
export interface LLMFile {
  type: "file" | "image"
  name: string
  content: NonSharedBuffer
  mediaType: string
}
