import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { z } from "zod"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"

type QwenAgentModel = AgentModelOf<AgentProvider.Qwen>

@Injectable()
export class AISDKQwenProvider extends AISDKVllmProviderBase<AgentProvider.Qwen> {
  protected readonly providerName = "Qwen Provider"

  protected readonly modelOptions: Record<QwenAgentModel, ModelOptions> = {
    // Qwen's recommended non-thinking sampling (model card): temperature 0.7, top_p 0.8, top_k 20, presence_penalty 1.5.
    [AgentModel.Qwen38_27B]: defineModelOptions(
      z.object({ temperature: z.number().min(0).max(2) }),
      {
        temperature: 0.7,
      },
    ),
  }
  protected readonly modelInfos: Record<QwenAgentModel, ModelInfos> = {
    [AgentModel.Qwen38_27B]: {},
  }

  getAgentProvider(): AgentProvider.Qwen {
    return AgentProvider.Qwen
  }
}
