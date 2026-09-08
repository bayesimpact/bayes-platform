import { AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
  LLMServiceTier,
} from "@/common/interfaces/llm-provider.interface"

export abstract class LlmServiceBase {
  constructor({
    mockLlmProvider,
    vertexLlmProvider,
    vertex3LlmProvider,
    mistralLlmProvider,
    medGemmaLlmProvider,
    gemmaLlmProvider,
  }: {
    mockLlmProvider: LLMProvider
    vertexLlmProvider: LLMProvider
    vertex3LlmProvider: LLMProvider
    mistralLlmProvider: LLMProvider
    medGemmaLlmProvider: LLMProvider
    gemmaLlmProvider: LLMProvider
  }) {
    this._mockLlmProvider = mockLlmProvider
    this.vertexLlmProvider = vertexLlmProvider
    this.vertex3LlmProvider = vertex3LlmProvider
    this.mistralLlmProvider = mistralLlmProvider
    this.medGemmaLlmProvider = medGemmaLlmProvider
    this.gemmaLlmProvider = gemmaLlmProvider
  }
  private readonly _mockLlmProvider: LLMProvider
  private readonly vertexLlmProvider: LLMProvider
  private readonly vertex3LlmProvider: LLMProvider
  private readonly mistralLlmProvider: LLMProvider
  private readonly medGemmaLlmProvider: LLMProvider
  private readonly gemmaLlmProvider: LLMProvider

  protected getProviderForModel: (model: string) => LLMProvider = (model) => {
    return this.getProviderForModelImpl(model)
  }
  private getProviderForModelImpl(model: string): LLMProvider {
    const provider = AgentModelToAgentProvider[model]
    switch (provider) {
      case AgentProvider._Mock:
        return this._mockLlmProvider
      case AgentProvider.Vertex:
        return this.vertexLlmProvider
      case AgentProvider.Vertex3:
        return this.vertex3LlmProvider
      case AgentProvider.Mistral:
        return this.mistralLlmProvider
      case AgentProvider.MedGemma:
        return this.medGemmaLlmProvider
      case AgentProvider.Gemma:
        return this.gemmaLlmProvider
      default:
        throw new NotImplementedException(`not supported llm provider: ${provider}`)
    }
  }
  protected buildLLMConfig(params: BuildLLMConfigParams): LLMConfig {
    const {
      systemPrompt,
      model,
      temperature,
      tools,
      fireAndForgetToolNames,
      endOfTurnTools,
      endOfTurnExecutionCounts,
      useExtendedTimeouts,
      priorityCallsEnabled,
      llmFeatures,
    } = params
    // Convert temperature to number (database decimal types may be returned as strings)
    const safeTemperature =
      typeof temperature === "string" ? parseFloat(temperature) : Number(temperature)

    // Validate temperature is a valid number
    if (Number.isNaN(safeTemperature) || safeTemperature < 0 || safeTemperature > 2) {
      throw new Error(
        `Invalid temperature value: ${safeTemperature}. Temperature must be a number between 0 and 2.`,
      )
    }
    let serviceTier: LLMServiceTier
    if (
      llmFeatures?.priorityCalls &&
      priorityCallsEnabled &&
      AgentModelToAgentProvider[model] === AgentProvider.Vertex3
    ) {
      serviceTier = "priority"
    }
    return {
      model,
      temperature: safeTemperature,
      systemPrompt,
      tools,
      fireAndForgetToolNames,
      endOfTurnTools,
      endOfTurnExecutionCounts,
      useExtendedTimeouts,
      serviceTier,
    } as LLMConfig
  }
}
