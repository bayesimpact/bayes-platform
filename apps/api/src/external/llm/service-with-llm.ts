import {
  type AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  type AgentTemperature,
} from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import type { ToolSet } from "ai"
import type { LLMConfig, LLMProvider } from "@/common/interfaces/llm-provider.interface"

export abstract class ServiceWithLLM {
  constructor({
    mockLlmProvider,
    vertexLlmProvider,
    medGemmaLlmProvider,
    gemmaLlmProvider,
  }: {
    mockLlmProvider: LLMProvider
    vertexLlmProvider: LLMProvider
    medGemmaLlmProvider: LLMProvider
    gemmaLlmProvider: LLMProvider
  }) {
    this._mockLlmProvider = mockLlmProvider
    this.vertexLlmProvider = vertexLlmProvider
    this.medGemmaLlmProvider = medGemmaLlmProvider
    this.gemmaLlmProvider = gemmaLlmProvider
  }
  private readonly _mockLlmProvider: LLMProvider
  private readonly vertexLlmProvider: LLMProvider
  private readonly medGemmaLlmProvider: LLMProvider
  private readonly gemmaLlmProvider: LLMProvider
  protected getProviderForModel(model: string): LLMProvider {
    const provider = AgentModelToAgentProvider[model]
    switch (provider) {
      case AgentProvider._Mock:
        return this._mockLlmProvider
      case AgentProvider.Vertex:
        return this.vertexLlmProvider
      case AgentProvider.MedGemma:
        return this.medGemmaLlmProvider
      case AgentProvider.Gemma:
        return this.gemmaLlmProvider
      default:
        throw new NotImplementedException(`not supported llm provider: ${provider}`)
    }
  }
  protected buildLLMConfig({
    systemPrompt,
    model,
    temperature,
    tools,
    useExtendedTimeouts,
  }: {
    tools?: ToolSet
    systemPrompt: string
    model: AgentModel
    temperature: AgentTemperature
    useExtendedTimeouts?: boolean
  }): LLMConfig {
    // Convert temperature to number (database decimal types may be returned as strings)
    const safeTemperature =
      typeof temperature === "string" ? parseFloat(temperature) : Number(temperature)

    // Validate temperature is a valid number
    if (Number.isNaN(safeTemperature) || safeTemperature < 0 || safeTemperature > 2) {
      throw new Error(
        `Invalid temperature value: ${safeTemperature}. Temperature must be a number between 0 and 2.`,
      )
    }
    return {
      model,
      temperature: safeTemperature,
      systemPrompt,
      tools,
      useExtendedTimeouts,
    } as LLMConfig
  }
}
