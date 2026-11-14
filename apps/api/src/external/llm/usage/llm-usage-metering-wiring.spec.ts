import type { LanguageModelV3, LanguageModelV3GenerateResult } from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable, Module } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { MockLanguageModelV3 } from "ai/test"
import { z } from "zod"
import type { LLMCallContext, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import { LlmUsageRepository } from "./llm-usage.repository"
import { LlmUsageMeteringModule } from "./llm-usage-metering.module"

/**
 * A provider without its own constructor, mirroring the production providers
 * (Gemma, MedGemma, Mistral, Qwen, Mock): it inherits the base constructor, so
 * the module must inject the meter into it through the inherited dependency.
 */
@Injectable()
class WireTestProvider extends AISDKLLMProviderBase<AgentProvider._Mock> {
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
    return new MockLanguageModelV3({
      doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
        content: [{ type: "text", text: "Hi" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 120, noCache: 100, cacheRead: 20, cacheWrite: 5 },
          outputTokens: { total: 80, text: 60, reasoning: 20 },
        },
        warnings: [],
      }),
    })
  }
}

@Module({
  imports: [LlmUsageMeteringModule],
  providers: [WireTestProvider],
})
class WireTestModule {}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

describe("LlmUsageMeteringModule wires the meter into the providers", () => {
  it("injects the meter into a provider that inherits the base constructor", async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({ imports: [WireTestModule] })
      .overrideProvider(LlmUsageRepository)
      .useValue({ insert })
      .compile()
    const provider = moduleRef.get(WireTestProvider)

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

    await provider.generateText({ prompt: "Hi", config, callContext, additionalMetadata: {} })
    await settle()

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "organization-id",
        agentMessageId: "agent-message-id",
        callKind: "internal",
        inputTokens: 120,
        outputTokens: 80,
      }),
    )
  })
})
