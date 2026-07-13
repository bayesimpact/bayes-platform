import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { type LanguageModel, simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import type { LLMConfig, MockValue } from "@/common/interfaces/llm-provider.interface"
import { generateRandomFromJSONSchema } from "@/common/test/random-generator"
import { AISDKLLMProviderBase, CallOrigin } from "@/external/llm/ai-sdk-llm-provider-base"

export type MockCall = {
  agentId: string | undefined
  callOrigin: CallOrigin
  prompt: string
}

type ResolvedMock =
  | { type: "text"; chunks: string[] }
  | { type: "toolCall"; toolName: string; params: unknown }

@Injectable()
export class AISDKMockProvider extends AISDKLLMProviderBase {
  private readonly queuesByAgentId = new Map<string, MockValue[]>()
  private readonly calls: MockCall[] = []
  private toolCallCounter = 0

  addTextTurn(agentId: string, ...values: string[]): void {
    this.enqueue(
      agentId,
      values.map((value) => ({ type: "text", value })),
    )
  }
  addObjectTurn(agentId: string, ...values: unknown[]): void {
    this.enqueue(
      agentId,
      values.map((value) => ({ type: "object", value })),
    )
  }
  addStreamTurn(agentId: string, ...values: string[][]): void {
    this.enqueue(
      agentId,
      values.map((chunks) => ({ type: "stream", chunks })),
    )
  }
  addToolCallTurn(agentId: string, toolName: string, input: unknown = {}): void {
    this.enqueue(agentId, [{ type: "toolCall", toolName, input }])
  }
  private enqueue(agentId: string, values: MockValue[]): void {
    const queue = this.queuesByAgentId.get(agentId) ?? []
    queue.push(...values)
    this.queuesByAgentId.set(agentId, queue)
  }

  resetMock(): void {
    this.queuesByAgentId.clear()
    this.calls.length = 0
    this.toolCallCounter = 0
  }

  getCalls(): readonly MockCall[] {
    return this.calls
  }

  getAgentProvider(): AgentProvider {
    return AgentProvider._Mock
  }

  getTags(config: LLMConfig): string[] {
    return ["MOCK-LLM", config.model]
  }

  getLanguageModel({ callOrigin }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    return new MockLanguageModelV3({
      doGenerate: async (options) => {
        const resolved = this.resolve({ mode: "generate", callOrigin, options })
        if (resolved.type === "toolCall") {
          return {
            content: [
              {
                type: "tool-call",
                toolCallId: this.getNextToolCallId(),
                toolName: resolved.toolName,
                input: JSON.stringify(resolved.params),
              },
            ],
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: this.usage,
            warnings: [],
          }
        }
        return {
          content: [{ type: "text", text: resolved.chunks.join("") }],
          finishReason: { unified: "stop", raw: undefined },
          usage: this.usage,
          warnings: [],
        }
      },
      doStream: async (options) => {
        const resolved = this.resolve({ mode: "stream", callOrigin, options })
        return {
          stream:
            resolved.type === "toolCall"
              ? this.toToolCallStream(resolved.toolName, resolved.params)
              : this.toTextStream(resolved.chunks),
        }
      },
    })
  }

  private resolve({
    mode,
    callOrigin,
    options,
  }: {
    mode: "generate" | "stream"
    callOrigin: CallOrigin
    options: LanguageModelV3CallOptions
  }): ResolvedMock {
    const agentId = this.getAgentId(options)
    this.calls.push({ agentId, callOrigin, prompt: JSON.stringify(options.prompt) })

    const next = agentId !== undefined ? this.queuesByAgentId.get(agentId)?.shift() : undefined
    if (next !== undefined) {
      switch (next.type) {
        case "text":
          return { type: "text", chunks: [next.value] }
        case "object":
          return { type: "text", chunks: [JSON.stringify(next.value)] }
        case "stream":
          return { type: "text", chunks: next.chunks }
        case "toolCall":
          return { type: "toolCall", toolName: next.toolName, params: next.input }
      }
    }

    const jsonSchema =
      options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined
    const withJsonSchema =
      jsonSchema !== undefined ||
      callOrigin === CallOrigin.generateObject ||
      callOrigin === CallOrigin.generateStructuredOutput
    if (withJsonSchema) {
      const object = jsonSchema
        ? generateRandomFromJSONSchema(jsonSchema)
        : { text: "text-mock-default-value", language: "language-mock-default-value" }
      return { type: "text", chunks: [JSON.stringify(object)] }
    }

    return {
      type: "text",
      chunks: [
        mode === "stream"
          ? "Hello, I'm the stream default mock value!"
          : "Hello, I'm the text default mock value!",
      ],
    }
  }

  private getAgentId(options: LanguageModelV3CallOptions): string | undefined {
    const agentId = options.providerOptions?.custom?.agentId
    return typeof agentId === "string" ? agentId : undefined
  }

  private getNextToolCallId(): string {
    this.toolCallCounter += 1
    return `mock-tool-call-${this.toolCallCounter}`
  }

  private toToolCallStream(toolName: string, input: unknown) {
    const parts: LanguageModelV3StreamPart[] = [
      {
        type: "tool-call",
        toolCallId: this.getNextToolCallId(),
        toolName,
        input: JSON.stringify(input),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: this.usage,
      },
    ]
    return simulateReadableStream({ chunks: parts })
  }

  private toTextStream(chunks: string[]) {
    const parts: LanguageModelV3StreamPart[] = [
      { type: "text-start", id: "text-1" },
      ...chunks.map<LanguageModelV3StreamPart>((delta) => ({
        type: "text-delta",
        id: "text-1",
        delta,
      })),
      { type: "text-end", id: "text-1" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: undefined },
        usage: this.usage,
      },
    ]
    return simulateReadableStream({ chunks: parts })
  }

  readonly usage = {
    inputTokens: {
      total: 0,
      noCache: 0,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: 0,
      text: 0,
      reasoning: undefined,
    },
  }
}
