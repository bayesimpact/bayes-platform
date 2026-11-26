import { AgentModel, type AgentModelOf, AgentProvider } from "@bayes-platform/api-contracts"
import { Injectable } from "@nestjs/common"
import type { ModelInfos } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import {
  AISDKGeminiProviderBase,
  type GeminiModel,
} from "@/external/llm/ai-sdk/providers/ai-sdk-gemini-provider-base"

type Vertex3AgentModel = AgentModelOf<AgentProvider.Vertex3>

/** Gemini 3.x on Vertex AI. */
@Injectable()
export class AISDKVertex3Provider extends AISDKGeminiProviderBase<AgentProvider.Vertex3> {
  getAgentProvider(): AgentProvider.Vertex3 {
    return AgentProvider.Vertex3
  }

  protected readonly geminiModels: Record<Vertex3AgentModel, GeminiModel> = {
    [AgentModel.Gemini31FlashLite]: {
      canSetTemperature: true,
      defaultLevel: "minimal",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35FlashLite]: {
      canSetTemperature: false,
      defaultLevel: "minimal",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35Flash]: {
      canSetTemperature: true,
      defaultLevel: "medium",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini36Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: [...this.thinkingLevels],
    },
    // Minimal was removed from 3.7 and up.
    [AgentModel.Gemini37Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },
    [AgentModel.Gemini38Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },
  }

  protected readonly modelOptions = this.buildModelOptions(this.geminiModels)

  /**
   * No model is served outside the EU since the 2026-09-04 probe: every Gemini 3.x flash and
   * flash-lite answers on "eu" (3.6-flash was global-only at the 2026-07-30 probe). When a new
   * model ships global-only, set `servedOutsideEu` here: the routing and the "(non-EU)" label of
   * the model pickers follow together.
   */
  protected readonly modelInfos: Record<Vertex3AgentModel, ModelInfos> = {
    [AgentModel.Gemini31FlashLite]: {},
    [AgentModel.Gemini35FlashLite]: {},
    [AgentModel.Gemini35Flash]: {},
    // Retirement dates from the Vertex AI model versions page (2026-11-19).
    [AgentModel.Gemini36Flash]: {
      deprecation: {
        deprecatedOn: "2026-11-19",
        recommendedReplacement: AgentModel.Gemini38Flash,
      },
    },
    [AgentModel.Gemini37Flash]: {
      deprecation: {
        deprecatedOn: "2027-01-28",
        recommendedReplacement: AgentModel.Gemini38Flash,
      },
    },
    [AgentModel.Gemini38Flash]: {},
  }
}
