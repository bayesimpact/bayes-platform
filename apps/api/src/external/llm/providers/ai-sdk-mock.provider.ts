import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { type LanguageModel, simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import type { LLMConfig, MockValue } from "@/common/interfaces/llm-provider.interface"
import { generateRandomFromJSONSchema } from "@/common/test/random-generator"
import { CallOrigin } from "@/external/llm/ai-sdk-llm-common"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk-llm-provider-base"

export type MockCall = {
  agentId: string | undefined
  callOrigin: CallOrigin
  prompt: string
  /** Names of the tools DECLARED to the model for this generation. */
  toolNames: string[]
  /** Serialized JSON schema DECLARED per tool for this generation. */
  toolSchemas: Record<string, string>
}

type ResolvedMock =
  | { type: "text"; chunks: string[] }
  | { type: "toolCall"; toolName: string; params: unknown }
  | { type: "textWithToolCall"; text: string; toolName: string; params: unknown }
  | { type: "error"; error: Error }

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
  /** Text answer + tool call in the SAME generation (fire-and-forget shape). */
  addTextWithToolCallTurn(
    agentId: string,
    text: string,
    toolName: string,
    input: unknown = {},
  ): void {
    this.enqueue(agentId, [{ type: "textWithToolCall", text, toolName, input }])
  }
  /** The next generation fails at the provider, the way a real 400 does. */
  addErrorTurn(agentId: string, error: Error): void {
    this.enqueue(agentId, [{ type: "error", error }])
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
      // Pass file/image URLs through instead of downloading them: attachments
      // are signed storage URLs that are unreachable from the test process.
      supportedUrls: { "*/*": [/.*/] },
      doGenerate: async (options) => {
        const resolved = this.resolve({ mode: "generate", callOrigin, options })
        if (resolved.type === "error") throw resolved.error
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
          content: [
            {
              type: "text",
              text: resolved.type === "textWithToolCall" ? resolved.text : resolved.chunks.join(""),
            },
          ],
          finishReason: { unified: "stop", raw: undefined },
          usage: this.usage,
          warnings: [],
        }
      },
      doStream: async (options) => {
        const resolved = this.resolve({ mode: "stream", callOrigin, options })
        if (resolved.type === "error") throw resolved.error
        return {
          stream:
            resolved.type === "toolCall"
              ? this.toToolCallStream(resolved.toolName, resolved.params)
              : resolved.type === "textWithToolCall"
                ? this.toTextWithToolCallStream(resolved.text, resolved.toolName, resolved.params)
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
    this.calls.push({
      agentId,
      callOrigin,
      prompt: JSON.stringify(options.prompt),
      toolNames: (options.tools ?? []).map((declaredTool) => declaredTool.name),
      toolSchemas: Object.fromEntries(
        (options.tools ?? [])
          .filter((declaredTool) => declaredTool.type === "function")
          .map((declaredTool) => [declaredTool.name, JSON.stringify(declaredTool.inputSchema)]),
      ),
    })

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
        case "textWithToolCall":
          return {
            type: "textWithToolCall",
            text: next.text,
            toolName: next.toolName,
            params: next.input,
          }
        case "error":
          return { type: "error", error: next.error }
      }
    }

    const jsonSchema =
      options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined
    const withJsonSchema =
      jsonSchema !== undefined || callOrigin === CallOrigin.generateStructuredOutput
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

  private toTextWithToolCallStream(text: string, toolName: string, input: unknown) {
    const parts: LanguageModelV3StreamPart[] = [
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: text },
      { type: "text-end", id: "text-1" },
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
