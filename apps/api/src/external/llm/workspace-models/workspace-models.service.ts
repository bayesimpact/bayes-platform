import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@bayes-platform/api-contracts"
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { EncryptionService } from "@/common/encryption/encryption.service"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import type { CustomModelRecord } from "./custom-model.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { CustomModelRepository } from "./custom-model.repository"
import type { ModelEndpointResolver, ModelEndpointSettings } from "./model-endpoint.types"
import { assertSafeModelEndpointUrl, InvalidModelEndpointUrlError } from "./model-endpoint-url"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectModelRepository } from "./project-model.repository"

/** The providers whose models run on vLLM servers: only they can be added with a server. */
export const SELF_HOSTED_PROVIDERS: ReadonlySet<AgentProvider> = new Set([
  AgentProvider.Gemma,
  AgentProvider.MedGemma,
  AgentProvider.Mistral,
  AgentProvider.Qwen,
])

/**
 * The providers a workspace gets only once someone turns them on: the self-hosted models, set up
 * by hand for each workspace, and the APIs served outside the EU or by another processor.
 */
const OPT_IN_PROVIDERS: ReadonlySet<AgentProvider> = new Set([
  ...SELF_HOSTED_PROVIDERS,
  AgentProvider.Anthropic,
  AgentProvider.OpenAI,
])

/** Whether a workspace offers a model of the code when it never set it. */
export function isModelEnabledByDefault(model: AgentModel): boolean {
  return !OPT_IN_PROVIDERS.has(AgentModelToAgentProvider[model])
}

export function isSelfHostedModel(model: AgentModel): boolean {
  return SELF_HOSTED_PROVIDERS.has(AgentModelToAgentProvider[model])
}

/** How long a resolved server is reused before the database is read again. */
const ENDPOINT_CACHE_TTL_MS = 30_000

/** The name the apps show for who runs the self-hosted models, e.g. "Bayes". */
const SELF_HOSTED_OPERATOR_ENV = "SELF_HOSTED_MODELS_OPERATOR"

export type ProjectModelView = {
  model: AgentModel
  provider: AgentProvider
  selfHosted: boolean
  enabled: boolean
  /** True when the workspace set it, false when it follows the default of the code. */
  customized: boolean
}

/** A model the workspace added, as the backoffice shows it. The key is never read back. */
export type CustomModelView = {
  id: string
  name: string
  baseModel: AgentModel
  provider: AgentProvider
  baseUrl: string
  hasApiKey: boolean
  servedModelName: string | null
  agentCount: number
  createdAt: Date
}

/** A model the workspace added, as its agents see it: no server, no key. */
export type AgentCustomModelView = { id: string; name: string; baseModel: AgentModel }

export type CustomModelInput = {
  name: string
  baseUrl: string
  /** Left out keeps the stored key, null removes it, a string replaces it. */
  apiKey?: string | null
  servedModelName: string | null
}

const logger = new Logger("WorkspaceModelsService")

/**
 * The two lists of models of a workspace: the models of the code it offers, and the models it
 * added on servers of its own. The LLM providers read the server of a call through
 * {@link ModelEndpointResolver}.
 */
@Injectable()
export class WorkspaceModelsService implements ModelEndpointResolver {
  private encryptionService?: EncryptionService
  private readonly endpointCache = new Map<
    string,
    { expiresAt: number; endpoint: ModelEndpointSettings | null }
  >()

  constructor(
    private readonly projectModelRepository: ProjectModelRepository,
    private readonly customModelRepository: CustomModelRepository,
    private readonly configService: ConfigService,
  ) {}

  /** Who runs the self-hosted models, for the badge of the apps. Null when not configured. */
  getSelfHostedOperator(): string | null {
    return this.configService.get<string>(SELF_HOSTED_OPERATOR_ENV)?.trim() || null
  }

  projectExists(projectId: string): Promise<boolean> {
    return this.projectModelRepository.projectExists(projectId)
  }

  // --- Models of the code ---

  async listProjectModels(projectId: string): Promise<ProjectModelView[]> {
    const rows = new Map(
      (await this.projectModelRepository.findByProject(projectId)).map((row) => [
        row.model,
        row.enabled,
      ]),
    )
    return listAgentModels().map((model) => {
      const stored = rows.get(model)
      return {
        model,
        provider: AgentModelToAgentProvider[model],
        selfHosted: isSelfHostedModel(model),
        enabled: stored ?? isModelEnabledByDefault(model),
        customized: stored !== undefined,
      }
    })
  }

  async listEnabledModels(projectId: string): Promise<Set<AgentModel>> {
    const models = await this.listProjectModels(projectId)
    return new Set(models.filter((model) => model.enabled).map((model) => model.model))
  }

  async setProjectModel(params: {
    projectId: string
    model: string
    enabled: boolean
  }): Promise<void> {
    await this.projectModelRepository.upsert({ ...params, model: toAgentModel(params.model) })
  }

  async resetProjectModel(params: { projectId: string; model: string }): Promise<void> {
    await this.projectModelRepository.deleteOne({ ...params, model: toAgentModel(params.model) })
  }

  // --- Added models ---

  async listCustomModels(projectId: string): Promise<CustomModelView[]> {
    const [models, agentCounts] = await Promise.all([
      this.customModelRepository.findByProject(projectId),
      this.customModelRepository.countAgentsByModel(projectId),
    ])
    return models.map((model) => toCustomModelView(model, agentCounts.get(model.id) ?? 0))
  }

  /** The added models as the agents of the workspace see them. */
  async listCustomModelsForAgents(projectId: string): Promise<AgentCustomModelView[]> {
    const models = await this.customModelRepository.findByProject(projectId)
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      baseModel: model.baseModel as AgentModel,
    }))
  }

  /** The self-hosted models of the code an added model can run. */
  listCustomModelTypes(): { model: AgentModel; provider: AgentProvider }[] {
    return listAgentModels()
      .filter(isSelfHostedModel)
      .map((model) => ({ model, provider: AgentModelToAgentProvider[model] }))
  }

  async createCustomModel(params: {
    projectId: string
    baseModel: string
    input: CustomModelInput
  }): Promise<string> {
    const baseModel = toAgentModel(params.baseModel)
    if (!isSelfHostedModel(baseModel))
      throw new BadRequestException(`Model ${baseModel} is not self-hosted: it takes no server`)
    const id = await this.customModelRepository.create({
      projectId: params.projectId,
      fields: {
        baseModel,
        ...(await this.toStoredFields({ input: params.input, storedKey: null })),
      },
    })
    this.endpointCache.clear()
    return id
  }

  async updateCustomModel(params: {
    projectId: string
    id: string
    input: CustomModelInput
  }): Promise<void> {
    const existing = await this.getCustomModel(params)
    await this.customModelRepository.update({
      projectId: params.projectId,
      id: params.id,
      fields: {
        baseModel: existing.baseModel,
        ...(await this.toStoredFields({
          input: params.input,
          storedKey: existing.apiKeyEncrypted,
        })),
      },
    })
    this.endpointCache.clear()
  }

  async deleteCustomModel(params: { projectId: string; id: string }): Promise<void> {
    await this.getCustomModel(params)
    const agentCount =
      (await this.customModelRepository.countAgentsByModel(params.projectId)).get(params.id) ?? 0
    if (agentCount > 0)
      throw new ConflictException(
        `${agentCount} agent(s) use this model: switch them to another model first`,
      )
    await this.customModelRepository.deleteOne(params)
    this.endpointCache.clear()
  }

  /**
   * Checks the model an agent picks: an added model must belong to the workspace and run the
   * model of the code it is saved with.
   */
  async assertCustomModelUsable(params: {
    projectId: string
    customModelId: string
    model: string
  }): Promise<void> {
    const customModel = await this.customModelRepository.findOne({
      projectId: params.projectId,
      id: params.customModelId,
    })
    if (!customModel) throw new BadRequestException("Unknown model of this workspace")
    if (customModel.baseModel !== params.model)
      throw new BadRequestException(
        `The model of this workspace runs ${customModel.baseModel}, not ${params.model}`,
      )
  }

  // --- Calls ---

  /**
   * The server of a call: the one of the model the agent revision runs, when the workspace added
   * it and it runs the model of the call (a judge or a side call on another model keeps the
   * environment variables). A stored URL that is no longer safe is skipped with a warning.
   */
  async resolveEndpoint({
    callContext,
    model,
  }: {
    callContext: LLMCallContext
    model: string
  }): Promise<ModelEndpointSettings | null> {
    const { projectId, agentId, revision } = callContext
    const cacheKey = `${projectId}:${agentId}:${revision}:${model}`
    const cached = this.endpointCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.endpoint

    const endpoint = await this.readEndpoint({ projectId, agentId, revision, model })
    this.endpointCache.set(cacheKey, { expiresAt: Date.now() + ENDPOINT_CACHE_TTL_MS, endpoint })
    return endpoint
  }

  private async readEndpoint(params: {
    projectId: string
    agentId: string
    revision: number
    model: string
  }): Promise<ModelEndpointSettings | null> {
    const customModel = await this.customModelRepository.findForAgentRevision(params)
    if (!customModel || customModel.baseModel !== params.model) return null
    try {
      return {
        url: await assertSafeModelEndpointUrl(customModel.baseUrl),
        apiKey: customModel.apiKeyEncrypted
          ? this.getEncryptionService().decrypt(customModel.apiKeyEncrypted)
          : null,
        servedModelName: customModel.servedModelName,
      }
    } catch (error) {
      logger.warn("Skipped the server of a model of the workspace, the environment applies", {
        projectId: params.projectId,
        customModelId: customModel.id,
        reason: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  private async getCustomModel(params: {
    projectId: string
    id: string
  }): Promise<CustomModelRecord> {
    const customModel = await this.customModelRepository.findOne(params)
    if (!customModel) throw new NotFoundException(`Model ${params.id} not found`)
    return customModel
  }

  private async toStoredFields({
    input,
    storedKey,
  }: {
    input: CustomModelInput
    storedKey: string | null
  }) {
    return {
      name: input.name.trim(),
      baseUrl: await toSafeUrl(input.baseUrl),
      apiKeyEncrypted:
        input.apiKey === undefined
          ? storedKey
          : input.apiKey === null || input.apiKey.trim() === ""
            ? null
            : this.getEncryptionService().encrypt(input.apiKey.trim()),
      servedModelName: input.servedModelName?.trim() || null,
    }
  }

  /** Built on first use, so an environment without stored keys needs no encryption key. */
  private getEncryptionService(): EncryptionService {
    this.encryptionService ??= new EncryptionService(this.configService)
    return this.encryptionService
  }
}

function listAgentModels(): AgentModel[] {
  return Object.values(AgentModel).filter((model) => model !== AgentModel._Mock)
}

function toAgentModel(value: string): AgentModel {
  const model = listAgentModels().find((agentModel) => agentModel === value)
  if (!model) throw new BadRequestException(`Unknown model: ${value}`)
  return model
}

async function toSafeUrl(baseUrl: string): Promise<string> {
  try {
    return await assertSafeModelEndpointUrl(baseUrl.trim())
  } catch (error) {
    if (error instanceof InvalidModelEndpointUrlError) throw new BadRequestException(error.message)
    throw error
  }
}

function toCustomModelView(model: CustomModelRecord, agentCount: number): CustomModelView {
  const baseModel = model.baseModel as AgentModel
  return {
    id: model.id,
    name: model.name,
    baseModel,
    provider: AgentModelToAgentProvider[baseModel],
    baseUrl: model.baseUrl,
    hasApiKey: model.apiKeyEncrypted !== null,
    servedModelName: model.servedModelName,
    agentCount,
    createdAt: model.createdAt,
  }
}
