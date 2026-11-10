import { AgentModelToAgentProvider, supportsServiceTiers } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import type {
  BuildLLMConfigParams,
  LLMConfig,
  LLMProvider,
  LLMServiceTier,
} from "@/common/interfaces/llm-provider.interface"
import { readIntEnv } from "@/common/utils/read-int-env"
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
      modelOptions,
      tools,
      fireAndForgetToolNames,
      terminalToolNames,
      useExtendedTimeouts,
      priorityCallsEnabled,
      llmFeatures,
    } = params
    const base = {
      model,
      modelOptions: modelOptions ?? undefined,
      systemPrompt,
      tools,
      fireAndForgetToolNames,
      terminalToolNames,
      useExtendedTimeouts,
    }
    if (params.isWorkerCall && llmFeatures?.flexWorkers && supportsServiceTiers(model)) {
      return {
        ...base,
        serviceTier: "flex",
        useExtendedTimeouts: true,
        nbRetriesOnSpecificErrors: readIntEnv("LLM_WORKERS_NB_RETRIES", 0),
        fallbackToStandardTier:
          process.env.LLM_WORKERS_ENABLE_FALLBACK_NORMAL_AFTER_RETRIES === "true",
      }
    }
    let serviceTier: LLMServiceTier
    if (llmFeatures?.priorityCalls && priorityCallsEnabled && supportsServiceTiers(model)) {
      serviceTier = "priority"
    }
    return { ...base, serviceTier }
  }
}
