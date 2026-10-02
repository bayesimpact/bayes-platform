import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { z } from "zod"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"

type GemmaAgentModel = AgentModelOf<AgentProvider.Gemma>

@Injectable()
export class AISDKGemmaProvider extends AISDKVllmProviderBase<AgentProvider.Gemma> {
  protected readonly providerName = "Gemma Provider"

  protected readonly modelOptions: Record<GemmaAgentModel, ModelOptions> = {
    [AgentModel.Gemma4_26B]: defineModelOptions(
      z.object({ temperature: z.number(), providerOptions: z.object({}) }),
      { temperature: 0, providerOptions: {} },
    ),
  }

  getAgentProvider(): AgentProvider.Gemma {
    return AgentProvider.Gemma
  }

  /** Gemma does not honour the response format: the object is read from its text. */
  protected override readStructuredOutput(result: {
    text: string
    output: Record<string, unknown>
  }): Record<string, unknown> {
    return this.parseStructuredOutputText(result.text)
  }
}
