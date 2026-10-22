import type {
  LanguageModelV3,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { simulateReadableStream, tool } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import type {
  LLMCallContext,
  LLMChatMessage,
  LLMConfig,
  LLMProvider,
  TelemetryMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

class TestProvider<
  Provider extends AgentProvider = AgentProvider._Mock,
> extends AISDKLLMProviderBase<Provider> {
  protected readonly modelOptions = {
    [AgentModel._Mock]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  } as Record<AgentModelOf<Provider>, ModelOptions>
  protected readonly modelInfos = {
    [AgentModel._Mock]: {},
  } as Record<AgentModelOf<Provider>, ModelInfos>

  constructor(
    private readonly agentProvider: Provider,
    private readonly model: LanguageModelV3,
  ) {
    super()
  }

  getAgentProvider(): Provider {
    return this.agentProvider
  }
  /** The call each model was built for. */
  readonly languageModelCalls: Array<{ callOrigin: CallOrigin; callContext: LLMCallContext }> = []

  getLanguageModel({
    callOrigin,
    callContext,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    callContext: LLMCallContext
  }): LanguageModelV3 {
    this.languageModelCalls.push({ callOrigin, callContext })
    return this.model
  }
  getTelemetryMetadata(_config: LLMConfig): TelemetryMetadata {
    return { test: "tag" }
  }
}

class TestProviderWithOverrides extends TestProvider {
  protected applySpecificToSystemPrompt({ systemPrompt }: { systemPrompt: string }): string {
    return `${systemPrompt} Answer briefly.`
  }
  protected buildSpecificProviderOptions() {
    return { providerOptions: { vertex: { thinkingBudget: 0 } } }
  }
}

class TestProviderWithStructuredOutputHooks extends TestProvider {
  protected applySpecificToStructuredOutputMessage({
    message,
  }: {
    message: LLMChatMessage
    config: LLMConfig
  }): LLMChatMessage {
    return { role: "user", content: `${message.content} Answer in English.` }
  }
  protected readStructuredOutput(result: {
    text: string
    output: Record<string, unknown>
  }): Record<string, unknown> {
    return { ...result.output, readBy: "provider" }
  }
}

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
}

function textParts(text: string): LanguageModelV3StreamPart[] {
  return [
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: text },
    { type: "text-end", id: "text-1" },
  ]
}

function finish(unified: "stop" | "tool-calls"): LanguageModelV3StreamPart {
  return { type: "finish", finishReason: { unified, raw: undefined }, usage }
}

/** A model that streams one step per call, in order. */
function buildStreamModel(...steps: LanguageModelV3StreamPart[][]): MockLanguageModelV3 {
  let callIndex = 0
  return new MockLanguageModelV3({
    doStream: async () => {
      const chunks = steps[callIndex] ?? [...textParts(""), finish("stop")]
      callIndex += 1
      return { stream: simulateReadableStream({ chunks }) }
    },
  })
}

/** A model whose generation is `text`. */
function buildGenerateModel(text: string): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  })
}

const callContext: LLMCallContext = {
  traceId: "trace-id",
  agentSessionId: "agent-session-id",
  currentTurn: 1,
  organizationId: "organization-id",
  projectId: "project-id",
  agentId: "agent-id",
  revision: 1,
  additionalMetadata: {},
}

const mockConfig: LLMConfig = {
  model: AgentModel._Mock,
  modelOptions: { temperature: 0.2 },
  systemPrompt: "You are a helpful assistant.",
  serviceTier: undefined,
}

async function collect(
  provider: LLMProvider,
  messages: LLMChatMessage[],
  config: LLMConfig = mockConfig,
): Promise<string> {
  let text = ""
  for await (const chunk of provider.streamChatResponse({ messages, config, callContext })) {
    text += chunk
  }
  return text
}

describe("AISDKLLMProviderBase", () => {
  describe("streamChatResponse", () => {
    it("streams the text the model writes", async () => {
      const model = buildStreamModel([...textParts("Hello, how can I help?"), finish("stop")])
      const provider = new TestProvider(AgentProvider._Mock, model)

      const text = await collect(provider, [{ role: "user", content: "Hi" }])

      expect(text).toBe("Hello, how can I help?")
    })

    it("sends the system message of the conversation first, then the other messages", async () => {
      const model = buildStreamModel([...textParts("Our plans start at 10 euros."), finish("stop")])
      const provider = new TestProvider(AgentProvider._Mock, model)

      await collect(provider, [
        { role: "system", content: "You answer pricing questions." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "What does it cost?" },
      ])

      const prompt = model.doStreamCalls[0]?.prompt
      expect(prompt?.map((message) => message.role)).toEqual([
        "system",
        "user",
        "assistant",
        "user",
      ])
      expect(prompt?.[0]).toEqual({ role: "system", content: "You answer pricing questions." })
    })

    it("falls back on the system prompt of the config", async () => {
      const model = buildStreamModel([...textParts("Hi"), finish("stop")])
      const provider = new TestProvider(AgentProvider._Mock, model)

      await collect(provider, [{ role: "user", content: "Hello" }])

      expect(model.doStreamCalls[0]?.prompt[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      })
      expect(model.doStreamCalls[0]?.temperature).toBe(0.2)
    })

    it("applies the provider's system prompt and specific call settings", async () => {
      const model = buildStreamModel([...textParts("Hi"), finish("stop")])
      const provider = new TestProviderWithOverrides(AgentProvider._Mock, model)

      await collect(provider, [{ role: "user", content: "Hello" }])

      expect(model.doStreamCalls[0]?.prompt[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant. Answer briefly.",
      })
      expect(model.doStreamCalls[0]?.temperature).toBeUndefined()
      expect(model.doStreamCalls[0]?.providerOptions).toEqual({ vertex: { thinkingBudget: 0 } })
    })

    it("builds the model for the call origin and the agent, with or without tools", async () => {
      const withoutTools = buildStreamModel([...textParts("Hi"), finish("stop")])
      const providerWithoutTools = new TestProvider(AgentProvider._Mock, withoutTools)
      await collect(providerWithoutTools, [{ role: "user", content: "Hello" }])
      const providerWithTools = new TestProvider(
        AgentProvider._Mock,
        buildStreamModel([...textParts("Hi"), finish("stop")]),
      )
      await collect(providerWithTools, [{ role: "user", content: "Hello" }], {
        ...mockConfig,
        tools: { lookup: tool({ inputSchema: z.object({}) }) },
      })

      expect(providerWithoutTools.languageModelCalls[0]).toMatchObject({
        callOrigin: CallOrigin.streamChatResponse,
        callContext: { agentId: "agent-id" },
      })
      expect(providerWithTools.languageModelCalls[0]?.callOrigin).toBe(
        CallOrigin.streamChatResponse_withTools,
      )
      // Nothing about the call travels in the provider options any more.
      expect(withoutTools.doStreamCalls[0]?.providerOptions?.custom).toBeUndefined()
    })

    it("recovers a verbalized tool call once, even when the recovery answer leaks it again", async () => {
      const LEAKED_CALL = "<call:default_api:notify_operator{severity:high}/>"
      const execute = jest.fn().mockResolvedValue("notified")
      let streamCalls = 0
      let generateCalls = 0
      const model = new MockLanguageModelV3({
        doStream: async () => {
          streamCalls += 1
          return {
            stream: simulateReadableStream({
              chunks: [...textParts(`Your request is noted. ${LEAKED_CALL}`), finish("stop")],
            }),
          }
        },
        // The recovery's structured output: valid arguments, followed by the
        // same verbalized call. Fed back into the list the recovery walks
        // through, it would be recovered again and again: past the second
        // call the model fails, so such a regression fails this test instead
        // of hanging the suite.
        doGenerate: async (): Promise<LanguageModelV3GenerateResult> => {
          generateCalls += 1
          if (generateCalls > 2) throw new Error("recovered the same call again and again")
          return {
            content: [{ type: "text", text: `{"severity":"high"} ${LEAKED_CALL}` }],
            finishReason: { unified: "stop", raw: undefined },
            usage,
            warnings: [],
          }
        },
      })
      const provider = new TestProvider(AgentProvider._Mock, model)

      const text = await collect(provider, [{ role: "user", content: "Escalate this." }], {
        ...mockConfig,
        tools: {
          notify_operator: tool({ inputSchema: z.object({ severity: z.string() }), execute }),
        },
      })

      expect(streamCalls).toBe(1)
      expect(text).not.toContain("<call:")
      expect(generateCalls).toBe(1)
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith({ severity: "high" }, expect.anything())
    })

    it("drops the text the model repeats after a tool result", async () => {
      const execute = jest.fn().mockResolvedValue("ok")
      const model = buildStreamModel(
        [
          ...textParts("All set."),
          { type: "tool-call", toolCallId: "call-1", toolName: "record", input: "{}" },
          finish("tool-calls"),
        ],
        [...textParts("All set."), finish("stop")],
      )
      const provider = new TestProvider(AgentProvider._Mock, model)

      const text = await collect(provider, [{ role: "user", content: "Save it" }], {
        ...mockConfig,
        tools: { record: tool({ inputSchema: z.object({}), execute }) },
      })

      expect(execute).toHaveBeenCalledTimes(1)
      expect(model.doStreamCalls).toHaveLength(2)
      expect(text).toBe("All set.")
    })

    it("rejects when the stream reports an error", async () => {
      const model = buildStreamModel([{ type: "error", error: new Error("provider unavailable") }])
      const provider = new TestProvider(AgentProvider._Mock, model)

      await expect(collect(provider, [{ role: "user", content: "Hello" }])).rejects.toThrow(
        "provider unavailable",
      )
    })

    it("rejects a conversation without user or assistant messages", async () => {
      const model = buildStreamModel()
      const provider = new TestProvider(AgentProvider._Mock, model)

      await expect(collect(provider, [{ role: "system", content: "System only" }])).rejects.toThrow(
        "no valid messages provided",
      )
      expect(model.doStreamCalls).toHaveLength(0)
    })

    it("rejects a model the provider does not serve", async () => {
      const model = buildStreamModel()
      const provider = new TestProvider(AgentProvider._Mock, model)

      await expect(
        collect(provider, [{ role: "user", content: "Hello" }], {
          ...mockConfig,
          model: AgentModel.Gemini25Flash,
        } as LLMConfig),
      ).rejects.toThrow("invalid association")
      expect(model.doStreamCalls).toHaveLength(0)
    })
  })

  describe("generateText", () => {
    it("returns the generated text, with the system prompt and the call options", async () => {
      const model = buildGenerateModel("A short summary.")
      const provider = new TestProvider(AgentProvider._Mock, model)

      const text = await provider.generateText({
        prompt: "Summarize this.",
        config: mockConfig,
        callContext,
      })

      expect(text).toBe("A short summary.")
      const call = model.doGenerateCalls[0]
      expect(call?.prompt[0]).toEqual({ role: "system", content: "You are a helpful assistant." })
      expect(call?.temperature).toBe(0.2)
      expect(provider.languageModelCalls[0]?.callOrigin).toBe(CallOrigin.generateText)
    })

    it("rejects a model the provider does not serve", async () => {
      const model = buildGenerateModel("unused")
      const provider = new TestProvider(AgentProvider._Mock, model)

      await expect(
        provider.generateText({
          prompt: "Summarize this.",
          config: { ...mockConfig, model: AgentModel.Gemini25Flash } as LLMConfig,
          callContext,
        }),
      ).rejects.toThrow("invalid association")
      expect(model.doGenerateCalls).toHaveLength(0)
    })
  })

  describe("generateStructuredOutput", () => {
    const schema = {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    }

    it("returns the object the model generated for the schema", async () => {
      const model = buildGenerateModel('{"title":"Pricing"}')
      const provider = new TestProvider(AgentProvider._Mock, model)

      const output = await provider.generateStructuredOutput({
        message: { role: "user", content: "Give it a title." },
        schema,
        config: mockConfig,
        callContext,
      })

      expect(output).toEqual({ title: "Pricing" })
      const call = model.doGenerateCalls[0]
      expect(call?.responseFormat).toMatchObject({ type: "json", schema })
      expect(provider.languageModelCalls[0]?.callOrigin).toBe(CallOrigin.generateStructuredOutput)
    })

    it("rejects a system message", async () => {
      const model = buildGenerateModel("{}")
      const provider = new TestProvider(AgentProvider._Mock, model)

      await expect(
        provider.generateStructuredOutput({
          message: { role: "system", content: "System only" },
          schema,
          config: mockConfig,
          callContext,
        }),
      ).rejects.toThrow("no valid messages provided")
    })

    it("lets the provider adapt the message before the call", async () => {
      const model = buildGenerateModel('{"title":"Pricing"}')
      const provider = new TestProviderWithStructuredOutputHooks(AgentProvider._Mock, model)

      await provider.generateStructuredOutput({
        message: { role: "user", content: "Give it a title." },
        schema,
        config: mockConfig,
        callContext,
      })

      expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain(
        "Give it a title. Answer in English.",
      )
    })

    it("lets the provider read the object from the result", async () => {
      const model = buildGenerateModel('{"title":"Pricing"}')
      const provider = new TestProviderWithStructuredOutputHooks(AgentProvider._Mock, model)

      const output = await provider.generateStructuredOutput({
        message: { role: "user", content: "Give it a title." },
        schema,
        config: mockConfig,
        callContext,
      })

      expect(output).toEqual({ title: "Pricing", readBy: "provider" })
    })
  })
})
