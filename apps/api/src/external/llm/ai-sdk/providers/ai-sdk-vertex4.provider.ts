import { AgentModel, type AgentModelOf, AgentProvider } from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import type { ModelInfos } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import {
  AISDKGeminiProviderBase,
  type GeminiModel,
} from "@/external/llm/ai-sdk/providers/ai-sdk-gemini-provider-base"

type Vertex4AgentModel = AgentModelOf<AgentProvider.Vertex4>

@Injectable()
export class AISDKVertex4Provider extends AISDKGeminiProviderBase<AgentProvider.Vertex4> {
  getAgentProvider(): AgentProvider.Vertex4 {
    return AgentProvider.Vertex4
  }

  protected readonly geminiModels: Record<Vertex4AgentModel, GeminiModel> = {
    [AgentModel.Gemini4Argon]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },

    [AgentModel.Gemini4Carbon]: {
      canSetTemperature: false,
      defaultLevel: "low",
      levels: ["low", "medium"], //see later if better perf to add "high" (high is actually available but very slow : > 120s)
    },
    [AgentModel.Gemini4Hydrogen]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },
  }

  protected readonly modelOptions = this.buildModelOptions(this.geminiModels)

  protected readonly modelInfos: Record<Vertex4AgentModel, ModelInfos> = {
    [AgentModel.Gemini4Argon]: {},
    [AgentModel.Gemini4Carbon]: { servedOutsideEu: true },
    [AgentModel.Gemini4Hydrogen]: {},
  }
}
