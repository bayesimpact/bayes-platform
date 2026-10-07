import {
  AgentModelToAgentProvider,
  AgentProvider,
  AgentThinkingLevel,
} from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
  LLMServiceTier,
} from "@/common/interfaces/llm-provider.interface"
import type { LlmProviders } from "@/external/llm/llm.module"

export abstract class LlmServiceBase {
  constructor(private readonly llmProviders: LlmProviders) {}

  // An arrow function: services pass it on as a callback.
  protected getProviderForModel: (model: string) => LLMProvider = (model) => {
    const provider = this.llmProviders[AgentModelToAgentProvider[model]]
    if (!provider) throw new NotImplementedException(`not supported llm model: ${model}`)
    return provider
  }

  protected buildLLMConfig(params: BuildLLMConfigParams): LLMConfig {
    const {
      systemPrompt,
      model,
      temperature,
      tools,
      fireAndForgetToolNames,
      terminalToolNames,
      useExtendedTimeouts,
      priorityCallsEnabled,
      llmFeatures,
      thinkingLevel,
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
      terminalToolNames,
      useExtendedTimeouts,
      serviceTier,
      thinkingLevel: thinkingLevel ?? AgentThinkingLevel.Auto,
    }
  }
}
