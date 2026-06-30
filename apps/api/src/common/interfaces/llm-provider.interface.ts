import type { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { ModelMessage, ToolSet } from "ai"
import type { ZodObject, z } from "zod"
export type LLMChatMessage = ModelMessage

type MockModels =
  | AgentModel._MockGenerateObject
  | AgentModel._MockGenerateStructuredOutput
  | AgentModel._MockGenerateText
  | AgentModel._MockRate
  | AgentModel._MockStreamChatResponse
export type LLMConfig =
  | {
      model: MockModels
      temperature: number
      systemPrompt?: string
      mockResult: string | string[]
      tools?: ToolSet
      useExtendedTimeouts?: never
    }
  | {
      model: Exclude<string, MockModels>
      temperature: number
      systemPrompt?: string
      mockResult?: never
      tools?: ToolSet
      /**
       * Opt in to the extended network timeouts on the underlying provider fetch
       * (see {@link AISDKVertexProvider}). Reserved for long-running calls such as
       * extraction agent runs; defaults to the provider's standard timeouts.
       */
      useExtendedTimeouts?: boolean
    }
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

  generateChatResponse({
    message,
    config,
    metadata,
  }: {
    message: LLMChatMessage
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string>

  generateText({
    prompt,
    config,
    metadata,
  }: {
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string>
  // biome-ignore lint/suspicious/noExplicitAny: @Did ? une idée
  generateObject<T extends ZodObject<any>>({
    schema,
    prompt,
    config,
    metadata,
  }: {
    schema: T
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<z.infer<T>>

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
