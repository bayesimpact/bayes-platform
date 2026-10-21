import type { JSONValue } from "@ai-sdk/provider"
import type { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { ModelMessage, ToolSet } from "ai"
import type { ZodType } from "zod"
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
  // A tool call whose arguments the model broke (invalid JSON): the provider
  // streams the arguments but never emits the call itself.
  | { type: "malformedToolCall"; toolName: string; rawInput: string }
  // A generation that fails at the provider (e.g. a 400 APICallError).
  | { type: "error"; error: Error }

/**
 * The call settings that vary by model, spread last into each AI SDK call:
 * the temperature, left out when the model must not receive one, and the
 * provider options keyed by provider (e.g. `vertex` for its thinking level),
 * left out when the model has none.
 */
export type SpecificProviderOptions = {
  temperature?: number
  providerOptions?: Record<string, Record<string, JSONValue>>
}

/**
 * The options an agent stores for its model (`agent_settings.provider_options`),
 * or the ones an internal call sets (e.g. `{ temperature: 0 }`). Merged over the
 * model's defaults and checked against the model's schema on every call.
 */
export type LLMModelOptions = Record<string, unknown>

export type LLMFeatures = {
  priorityCalls?: boolean
  flexWorkers?: boolean
}
export type BuildLLMConfigParams = {
  model: AgentSettings["model"]
  systemPrompt: string
  modelOptions?: AgentSettings["providerOptions"]
  tools?: ToolSet
  fireAndForgetToolNames?: string[]
  terminalToolNames?: string[]
  priorityCallsEnabled: boolean
  llmFeatures: LLMFeatures
  useExtendedTimeouts?: boolean
}
export type LLMConfig =
  | {
      model: MockModels
      modelOptions?: LLMModelOptions
      systemPrompt?: string
      tools?: ToolSet
      fireAndForgetToolNames?: string[]
      terminalToolNames?: string[]
      useExtendedTimeouts?: never
      serviceTier: never
    }
  | {
      model: Exclude<string, MockModels>
      /** See {@link LLMModelOptions}. */
      modelOptions?: LLMModelOptions
      systemPrompt?: string
      tools?: ToolSet
      /**
       * Names of tools in {@link tools} whose output the model never needs
       * (logging-style tools such as sources). When a tool-loop step only
       * invokes these, the loop stops instead of running another generation.
       */
      fireAndForgetToolNames?: string[]
      /**
       * Names of tools in {@link tools} whose call ends the turn: once one ran,
       * the loop allows at most one more generation (the closing sentence) and
       * stops, whatever else the model would call. Used for a hand-over to a
       * sub-agent: the next words belong to the sub-agent.
       */
      terminalToolNames?: string[]
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
  tags: Record<string, string | number | string[]>
  /**
   * Session of the parent run, set by sub-agents so their dedicated traces link
   * back to it.
   */
  parentSessionId?: string
  /**
   * Labels the spans of a call that is not the answering loop of the turn
   * (e.g. the post-turn classification), so traces read
   * "Turn #4 · classification" instead of a second bare "Turn #4".
   */
  spanLabel?: string
}

export interface LLMProvider {
  getAgentProvider(): AgentProvider
  /** The schema of a model's options, checked on every call. */
  getModelOptionsSchema(agentModel: AgentModel): ZodType<SpecificProviderOptions>
  /** A model's options when the call sets none. */
  getModelOptions(agentModel: AgentModel): SpecificProviderOptions
  /**
   * The options of an internal call that wants a steady answer (turn classification, the
   * evaluation judge), as a model takes them: a temperature of 0, or nothing for a model
   * that must run on its default temperature.
   */
  getInternalCallModelOptions(agentModel: AgentModel): LLMModelOptions
  /** What the catalog says of a model (retirement, data residency). */
  getModelMetadata(agentModel: AgentModel): {
    deprecation?: { deprecatedOn: string; recommendedReplacement: AgentModel }
    servedOutsideEu?: boolean
  }
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
