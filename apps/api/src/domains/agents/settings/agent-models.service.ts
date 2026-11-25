import {
  AgentModel,
  type AgentModelDeprecation,
  AgentModelToAgentProvider,
  type AgentProvider,
} from "@caseai-connect/api-contracts"
import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import { z } from "zod"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  type AgentCustomModelView,
  isSelfHostedModel,
  WorkspaceModelsService,
} from "@/external/llm/workspace-models/workspace-models.service"

export const AGENT_DEFAULT_MODELS = {
  agent: AgentModel.Gemini35FlashLite,
  judge: AgentModel.Gemini35FlashLite,
} as const satisfies AvailableModels["defaults"]

export type AgentModelData = {
  agentModel: AgentModel
  agentProvider: AgentProvider
  isAvailable: boolean
  selfHosted: boolean
  agentModelDeprecation: AgentModelDeprecation | null
  servedOutsideEu: boolean
  optionsSchema: Record<string, unknown>
  defaultOptions: Record<string, unknown>
}

export type AvailableModels = {
  models: AgentModelData[]
  defaults: { agent: AgentModel; judge: AgentModel }
  /** The models the workspace added on servers of its own. Never their server or key. */
  customModels: AgentCustomModelView[]
  /** Who runs the self-hosted models, for their badge. Null when not configured. */
  selfHostedBy: string | null
}

@Injectable()
export class AgentModelsService {
  constructor(
    @Inject(LLM_PROVIDERS) private readonly llmProviders: LlmProviders,
    private readonly workspaceModelsService: WorkspaceModelsService,
  ) {}

  /**
   * Every model of the code, marked available when the workspace offers it and it is not retired,
   * and the models the workspace added.
   */
  async getAvailableModels(projectId: string): Promise<AvailableModels> {
    const [enabledModels, customModels] = await Promise.all([
      this.workspaceModelsService.listEnabledModels(projectId),
      this.workspaceModelsService.listCustomModelsForAgents(projectId),
    ])
    const availableModels = Object.values(AgentModel)
      .filter((agentModel) => agentModel !== AgentModel._Mock)
      .map((agentModel) => {
        const agentProvider = AgentModelToAgentProvider[agentModel]
        const llmProvider = this.llmProviders[agentProvider]
        const modelInfos = llmProvider.getModelInfos(agentModel)
        return {
          agentModel,
          agentProvider,
          isAvailable:
            enabledModels.has(agentModel) && !this.isModelRetired(modelInfos.deprecation),
          selfHosted: isSelfHostedModel(agentModel),
          agentModelDeprecation: modelInfos.deprecation ?? null,
          servedOutsideEu: modelInfos.servedOutsideEu === true,
          optionsSchema: z.toJSONSchema(llmProvider.getModelOptionsSchema(agentModel)) as Record<
            string,
            unknown
          >,
          defaultOptions: llmProvider.getModelOptions(agentModel),
        }
      })
    return {
      models: availableModels,
      defaults: AGENT_DEFAULT_MODELS,
      customModels,
      selfHostedBy: this.workspaceModelsService.getSelfHostedOperator(),
    }
  }

  /**
   * Checks the model an agent picks: a model of the code the workspace offers, or a model the
   * workspace added (`customModelId`), which runs `model`.
   */
  async assertAvailable({
    projectId,
    model,
    customModelId,
  }: {
    projectId: string
    model: string
    customModelId?: string | null
  }): Promise<void> {
    if ((model as AgentModel) === AgentModel._Mock && !customModelId) return
    const provider = AgentModelToAgentProvider[model as AgentModel]
    if (!provider) throw new BadRequestException(`Unknown model: ${model}`)
    if (customModelId) {
      await this.workspaceModelsService.assertCustomModelUsable({
        projectId,
        customModelId,
        model,
      })
    } else {
      const enabledModels = await this.workspaceModelsService.listEnabledModels(projectId)
      if (!enabledModels.has(model as AgentModel))
        throw new BadRequestException(`Model ${model} is not available in this workspace`)
    }
    const llmProvider = this.llmProviders[provider]
    if (this.isModelRetired(llmProvider.getModelInfos(model as AgentModel).deprecation))
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
}
