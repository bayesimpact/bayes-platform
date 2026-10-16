import {
  AgentModel,
  type AgentModelDeprecation,
  AgentModelToAgentProvider,
  AgentProvider,
  type FeatureFlagKey,
} from "@caseai-connect/api-contracts"
import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import { z } from "zod"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"

export const AGENT_DEFAULT_MODELS = {
  agent: AgentModel.Gemini35FlashLite,
  judge: AgentModel.Gemini35FlashLite,
} as const satisfies AvailableModels["defaults"]

const PROVIDERS_WITH_FEATURE_FLAGS: Partial<Record<AgentProvider, FeatureFlagKey>> = {
  [AgentProvider.MedGemma]: "medgemma",
  [AgentProvider.Gemma]: "gemma",
  [AgentProvider.Mistral]: "mistral",
}

export type AgentModelData = {
  agentModel: AgentModel
  agentProvider: AgentProvider
  isAvailable: boolean
  agentModelDeprecation: AgentModelDeprecation | null
  servedOutsideEu: boolean
  optionsSchema: Record<string, unknown>
  defaultOptions: Record<string, unknown>
}

export type AvailableModels = {
  models: AgentModelData[]
  defaults: { agent: AgentModel; judge: AgentModel }
}

@Injectable()
export class AgentModelsService {
  constructor(@Inject(LLM_PROVIDERS) private readonly llmProviders: LlmProviders) {}

  getAvailableModelsForFeatures(features: FeatureFlagKey[]): AvailableModels {
    const availableProviders = this.listAvailableProviders(features)
    const availableModels = Object.values(AgentModel)
      .filter((agentModel) => agentModel !== AgentModel._Mock)
      .map((agentModel) => {
        const agentProvider = AgentModelToAgentProvider[agentModel]
        const llmProvider = this.llmProviders[agentProvider]
        const metadata = llmProvider.getModelMetadata(agentModel)
        return {
          agentModel,
          agentProvider,
          isAvailable:
            availableProviders.has(agentProvider) && !this.isModelRetired(metadata.deprecation),
          agentModelDeprecation: metadata.deprecation ?? null,
          servedOutsideEu: metadata.servedOutsideEu === true,
          optionsSchema: z.toJSONSchema(llmProvider.getModelOptionsSchema(agentModel)) as Record<
            string,
            unknown
          >,
          defaultOptions: llmProvider.getModelOptions(agentModel),
        }
      })
    return { models: availableModels, defaults: AGENT_DEFAULT_MODELS }
  }

  assertAvailable({ features, model }: { features: FeatureFlagKey[]; model: string }): void {
    if ((model as AgentModel) === AgentModel._Mock) return
    const provider = AgentModelToAgentProvider[model as AgentModel]
    if (!provider) throw new BadRequestException(`Unknown model: ${model}`)
    if (!this.listAvailableProviders(features).has(provider))
      throw new BadRequestException(`Model ${model} is not available in this project`)
    const llmProvider = this.llmProviders[provider]
    if (this.isModelRetired(llmProvider.getModelMetadata(model as AgentModel).deprecation))
      throw new BadRequestException(`Model ${model} is no longer available`)
  }

  resolveModelOptions({
    model,
    providerOptions,
  }: {
    model: AgentModel
    providerOptions: Record<string, unknown> | null | undefined
  }): Record<string, unknown> {
    const llmProvider = this.llmProviders[AgentModelToAgentProvider[model]]
    if (providerOptions == null) return llmProvider.getModelOptions(model)
    const parsed = llmProvider.getModelOptionsSchema(model).safeParse(providerOptions)
    if (!parsed.success)
      throw new BadRequestException(
        `Invalid options for model ${model}: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      )
    return parsed.data
  }

  isModelRetired(deprecation: AgentModelDeprecation | undefined, now: Date = new Date()): boolean {
    if (!deprecation) return false
    return now.toISOString().slice(0, 10) > deprecation.deprecatedOn
  }

  private listAvailableProviders(features: FeatureFlagKey[]): Set<AgentProvider> {
    return new Set(
      Object.values(AgentProvider).filter((provider) => {
        if (provider === AgentProvider._Mock) return false
        const feature = PROVIDERS_WITH_FEATURE_FLAGS[provider]
        return !feature || features.includes(feature)
      }),
    )
  }
}
