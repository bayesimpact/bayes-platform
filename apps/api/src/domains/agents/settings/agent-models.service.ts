import {
  AgentModel,
  type AgentModelsDto,
  AgentModelToAgentProvider,
  AgentProvider,
  type FeatureFlagKey,
} from "@caseai-connect/api-contracts"
import { BadRequestException, forwardRef, Inject, Injectable } from "@nestjs/common"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { ProjectsService } from "@/domains/projects/projects.service"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"

/** The model a new agent starts on, and the one a new evaluation run is judged by. */
export const AGENT_MODEL_DEFAULTS = {
  agent: AgentModel.Gemini35FlashLite,
  judge: AgentModel.Gemini35FlashLite,
} as const satisfies AgentModelsDto["defaults"]

/**
 * The providers a project only sees with a feature flag. Vertex and Vertex 3.x are never gated:
 * Vertex 3.x holds the replacements of the deprecated Vertex models, so hiding it would leave a
 * project unable to migrate off them.
 */
const PROVIDER_FEATURE_FLAGS: Partial<Record<AgentProvider, FeatureFlagKey>> = {
  [AgentProvider.MedGemma]: "medgemma",
  [AgentProvider.Gemma]: "gemma",
  [AgentProvider.Mistral]: "mistral",
}

/** Models a test runs on, never offered to a project. */
const TEST_MODELS: AgentModel[] = [AgentModel._Mock]

/** The model catalog as a project sees it, read from the providers that serve each model. */
@Injectable()
export class AgentModelsService {
  constructor(
    @Inject(LLM_PROVIDERS) private readonly llmProviders: LlmProviders,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
  ) {}

  async listForProject(connectScope: RequiredConnectScope): Promise<AgentModelsDto> {
    const selectableProviders = await this.listSelectableProviders(connectScope)
    const models = Object.values(AgentModel)
      .filter((model) => !TEST_MODELS.includes(model))
      .map((model) => {
        const provider = AgentModelToAgentProvider[model]
        const llmProvider = this.llmProviders[provider]
        const metadata = llmProvider.getModelMetadata(model)
        return {
          model,
          provider,
          selectable: selectableProviders.has(provider),
          deprecation: metadata.deprecation ?? null,
          servedOutsideEu: metadata.servedOutsideEu === true,
          optionsSchema: z.toJSONSchema(llmProvider.getModelOptionsSchema(model)) as Record<
            string,
            unknown
          >,
          defaultOptions: llmProvider.getModelOptions(model),
        }
      })
    return { models, defaults: AGENT_MODEL_DEFAULTS }
  }

  /**
   * Rejects a model the project cannot pick: its provider is behind a feature flag the project
   * lacks. The test models stay allowed, for the specs that run agents on them.
   */
  async assertSelectable({
    connectScope,
    model,
  }: {
    connectScope: RequiredConnectScope
    model: string
  }): Promise<void> {
    if (TEST_MODELS.includes(model as AgentModel)) return
    const provider = AgentModelToAgentProvider[model as AgentModel]
    if (!provider) throw new BadRequestException(`Unknown model: ${model}`)
    const selectableProviders = await this.listSelectableProviders(connectScope)
    if (!selectableProviders.has(provider))
      throw new BadRequestException(`Model ${model} is not available in this project`)
  }

  private async listSelectableProviders(
    connectScope: RequiredConnectScope,
  ): Promise<Set<AgentProvider>> {
    const providers = await Promise.all(
      Object.values(AgentProvider).map(async (provider) => {
        if (provider === AgentProvider._Mock) return undefined
        const feature = PROVIDER_FEATURE_FLAGS[provider]
        if (!feature) return provider
        return (await this.projectsService.hasFeature({ connectScope, feature }))
          ? provider
          : undefined
      }),
    )
    return new Set(providers.filter((provider) => provider !== undefined))
  }
}
