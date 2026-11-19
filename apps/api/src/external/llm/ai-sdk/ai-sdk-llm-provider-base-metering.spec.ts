import type {
  LanguageModelV3,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import type {
  LLMCallContext,
  LLMChatMessage,
  LLMConfig,
} from "@/common/interfaces/llm-provider.interface"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import type { LlmUsageMeter } from "@/external/llm/usage/llm-usage-meter"

const meter = { recordUsage: jest.fn() }
const meterAsLlmUsageMeter = meter as unknown as LlmUsageMeter

/** A provider that forwards the meter to the base, so the boundary meters its calls. */
class MeteringTestProvider extends AISDKLLMProviderBase<AgentProvider._Mock> {
  protected readonly modelOptions = {
    [AgentModel._Mock]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  } as Record<AgentModelOf<AgentProvider._Mock>, ModelOptions>
  protected readonly modelInfos = {
    [AgentModel._Mock]: {},
  } as Record<AgentModelOf<AgentProvider._Mock>, ModelInfos>

  constructor(private readonly model: LanguageModelV3) {
    super(meterAsLlmUsageMeter)
  }

  getAgentProvider(): AgentProvider._Mock {
    return AgentProvider._Mock
  }

  getLanguageModel(): LanguageModelV3 {
    return this.model
  }
}

function streamModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t-1" },
          { type: "text-delta", id: "t-1", delta: "Hi" },
          { type: "text-end", id: "t-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 5 },
              outputTokens: { total: 80, text: 60, reasoning: 20 },
            },
          } satisfies LanguageModelV3StreamPart,
        ],
      }),
    }),
  })
}

const meteringUsage = {
  inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 5 },
  outputTokens: { total: 80, text: 60, reasoning: 20 },
}

function generateModel(text = "Hi"): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: meteringUsage,
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
  agentMessageId: "agent-message-id",
}

const config: LLMConfig = {
  model: AgentModel._Mock,
  modelOptions: { temperature: 0 },
  systemPrompt: "You are a helpful assistant.",
  serviceTier: undefined,
}

describe("AISDKLLMProviderBase metering", () => {
  beforeEach(() => {
    meter.recordUsage.mockClear()
  })

  it("meters a streamed turn as an answer, with the message the turn writes to", async () => {
    const provider = new MeteringTestProvider(streamModel())
    for await (const _ of provider.streamChatResponse({
      messages: [{ role: "user", content: "Hi" }],
      config,
      callContext,
      additionalMetadata: {},
    })) {
      // consume the stream
    }

    expect(meter.recordUsage).toHaveBeenCalledTimes(1)
    expect(meter.recordUsage).toHaveBeenCalledWith({
      callContext,
      model: AgentModel._Mock,
      provider: AgentProvider._Mock,
      callKind: "answer",
      usage: expect.objectContaining({ inputTokens: 120, outputTokens: 80 }),
    })
  })

  it("meters a text generation as an internal call", async () => {
    const provider = new MeteringTestProvider(generateModel())
    await provider.generateText({
      prompt: "Hi",
      config,
      callContext,
      additionalMetadata: {},
    })

    expect(meter.recordUsage).toHaveBeenCalledWith({
      callContext,
      model: AgentModel._Mock,
      provider: AgentProvider._Mock,
      callKind: "internal",
      usage: expect.objectContaining({ inputTokens: 120, outputTokens: 80 }),
    })
  })

  it("meters a structured-output generation as an internal call", async () => {
    const provider = new MeteringTestProvider(generateModel('{"answer":"Hi"}'))
    await provider.generateStructuredOutput({
      message: { role: "user", content: "Hi" } as LLMChatMessage,
      schema: { type: "object", properties: { answer: { type: "string" } } },
      config,
      callContext,
      additionalMetadata: {},
    })

    expect(meter.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ callKind: "internal" }),
    )
  })

  it("does not meter when no meter is wired in (the test providers)", async () => {
    // A provider built without a meter (super() with no argument) still works.
    class BareProvider extends AISDKLLMProviderBase<AgentProvider._Mock> {
      protected readonly modelOptions = {
        [AgentModel._Mock]: defineModelOptions(z.object({ temperature: z.number() }), {
          temperature: 0,
        }),
      } as Record<AgentModelOf<AgentProvider._Mock>, ModelOptions>
      protected readonly modelInfos = {
        [AgentModel._Mock]: {},
      } as Record<AgentModelOf<AgentProvider._Mock>, ModelInfos>

      getAgentProvider(): AgentProvider._Mock {
        return AgentProvider._Mock
      }
      getLanguageModel(): LanguageModelV3 {
        return generateModel()
      }
    }
    const provider = new BareProvider()
    await provider.generateText({
      prompt: "Hi",
      config,
      callContext,
      additionalMetadata: {},
    })
    expect(meter.recordUsage).not.toHaveBeenCalled()
  })
})
