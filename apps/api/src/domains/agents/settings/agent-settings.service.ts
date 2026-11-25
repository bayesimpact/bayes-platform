import type { AgentModel, EmbeddingModel } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  extractAgentSettingsUpdateFields,
  hasSameAgentSettings,
  requiresUpdateAgentSettings,
} from "@/domains/agents/settings/agent.settings.functions"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelsService } from "@/domains/documents/embeddings/project-embedding-models/project-embedding-models.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "@/domains/documents/tags/document-tags.service"
import type { DocumentTagsUpdateFields } from "@/domains/documents/tags/document-tags.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibrariesService } from "@/domains/resource-libraries/resource-libraries.service"
import type { ResourceLibrary } from "@/domains/resource-libraries/resource-library.entity"
import { Agent } from "../agent.entity"
import type { ConversationAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoriesService } from "../session-categories/agent-session-categories.service"
import { ProjectAgentSessionCategory } from "../session-categories/project-agent-session-category.entity"
import type { AgentSettingsUpdateFields } from "./agent.settings.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentModelsService, type AvailableModels } from "./agent-models.service"
import { AgentSettings } from "./agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsRepository } from "./agent-settings.repository"

@Injectable()
export class AgentSettingsService {
  private readonly agentConnectRepository: ConnectRepository<Agent>
  private readonly agentSettingsConnectRepository: ConnectRepository<AgentSettings>

  constructor(
    @InjectRepository(Agent)
    agentRepository: Repository<Agent>,

    @InjectRepository(AgentSettings)
    private agentSettingsTypeOrmRepository: Repository<AgentSettings>,

    private readonly agentSettingsRepository: AgentSettingsRepository,

    @InjectRepository(ProjectAgentSessionCategory)
    private readonly projectAgentSessionCategoryRepository: Repository<ProjectAgentSessionCategory>,

    private readonly agentSessionCategoriesService: AgentSessionCategoriesService,

    private readonly documentTagsService: DocumentTagsService,

    private readonly resourceLibrariesService: ResourceLibrariesService,

    private readonly agentModelsService: AgentModelsService,

    private readonly projectRepository: ProjectRepository,

    private readonly projectEmbeddingModelsService: ProjectEmbeddingModelsService,

    private readonly transactionService: TransactionService,
  ) {
    this.agentConnectRepository = new ConnectRepository(agentRepository, "agents")
    this.agentSettingsConnectRepository = new ConnectRepository(
      agentSettingsTypeOrmRepository,
      "agents",
    )
  }

  /** The exact settings row a run was pinned to, so a re-run uses the version it advertises. */
  async getById({
    connectScope,
    agentSettingsId,
  }: {
    connectScope: RequiredConnectScope
    agentSettingsId: string
  }): Promise<AgentSettings> {
    const found = await this.agentSettingsConnectRepository.getOneById(
      connectScope,
      agentSettingsId,
    )
    if (!found) throw new NotFoundException(`AgentSettings with id ${agentSettingsId} not found`)
    return found
  }

  async get({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
  }): Promise<AgentSettings | undefined> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (found.length > 0) {
      return found[0]
    }
    return undefined
  }
  private async getMaxRevision(agentId: string): Promise<number> {
    const last = await this.agentSettingsTypeOrmRepository
      .createQueryBuilder("as")
      .where("as.agentId = :agentId", { agentId })
      .orderBy("as.revision", "DESC")
      .getOne()
    if (last) return last.revision
    return 0
  }

  /** The newest revision, the draft when there is one. */
  async getLatest({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings> {
    const latest = await this.agentSettingsRepository.findLatest(connectScope, agentId)
    if (!latest) throw new NotFoundException(`AgentSettings with agentId ${agentId} not found`)
    return latest
  }

  /** The revision in production, which every live channel runs with. */
  async getProduction({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings> {
    const production = await this.findProduction({ connectScope, agentId })
    if (!production) {
      throw new NotFoundException(`Agent ${agentId} has no version in production`)
    }
    return production
  }

  /**
   * The revision in production, or undefined while the agent was never saved: a copy of an agent
   * starts with a draft only.
   */
  async findProduction({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings | undefined> {
    return (await this.agentSettingsRepository.findProduction(connectScope, agentId)) ?? undefined
  }

  /**
   * The newest saved revision, or undefined while the agent was never saved. It is newer than the
   * revision in production when the managers keep an older one live.
   */
  async findLatestSaved({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings | undefined> {
    return (await this.agentSettingsRepository.findLatestSaved(connectScope, agentId)) ?? undefined
  }

  /** The newest saved revision, or the draft of an agent that was never saved. */
  async getLastSavedOrDraft({
    connectScope,
    agentId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
  }): Promise<AgentSettings> {
    return (
      (await this.findLatestSaved({ connectScope, agentId })) ??
      this.getLatest({ connectScope, agentId })
    )
  }

  /** The agents among `agentIds` that have a revision in production. */
  async listAgentIdsInProduction({
    connectScope,
    agentIds,
  }: {
    connectScope: RequiredConnectScope
    agentIds: string[]
  }): Promise<Set<string>> {
    return new Set(
      await this.agentSettingsRepository.findAgentIdsInProduction(connectScope, agentIds),
    )
  }

  /**
   * Settings a conversation session runs with, from its greeting to each answer.
   *
   * A playground session with no explicit revision runs the draft when there is one. The Studio
   * playground renders before its settings history has loaded, so the client cannot always name
   * a revision, and defaulting that window to the published one would run a version the header
   * does not claim. A live session runs the revision in production: callers reject a revision on
   * it before reaching here. A review campaign tester session runs the revision its campaign
   * chose, which its callers read from the campaign instead.
   */
  async getForSession({
    connectScope,
    agentId,
    sessionType,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    sessionType: ConversationAgentSessionType
    revision: number | undefined
  }): Promise<AgentSettings> {
    if (revision === undefined) {
      return sessionType === "playground"
        ? this.getLatest({ connectScope, agentId })
        : this.getProduction({ connectScope, agentId })
    }

    const agentSettings = await this.get({ connectScope, agentId, revision })
    if (!agentSettings) {
      throw new NotFoundException(`Version ${revision} not found for agent ${agentId}`)
    }
    if (agentSettings.isArchived) {
      throw new UnprocessableEntityException(`Version ${revision} is archived and cannot be run`)
    }
    return agentSettings
  }

  async getAll({
    connectScope,
    agentId,
    includesDraft,
    includesArchived,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    includesDraft?: true
    includesArchived?: true
  }): Promise<AgentSettings[]> {
    return await this.agentSettingsConnectRepository.find(connectScope, {
      where: {
        agentId,
        ...(includesDraft ? {} : { isDraft: false }),
        ...(includesArchived ? {} : { isArchived: false }),
      },
      order: { revision: "DESC" },
    })
  }

  /**
   * Saves the draft as a version. It goes to production when the caller asks for it, and always
   * when the agent has no version in production yet, so a saved agent is always usable.
   *
   * Calling it again on a saved version renames it, except on the version in production, which
   * stays as it is.
   */
  async publish({
    connectScope,
    agentId,
    revision,
    revisionName,
    revisionDesc,
    setAsProduction,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
    revisionName?: string
    revisionDesc?: string
    setAsProduction?: boolean
  }): Promise<AgentSettings | undefined> {
    return this.transactionService.run(async () => {
      const found = await this.get({ connectScope, agentId, revision })
      if (!found || found.isArchived) return undefined
      if (found.isProduction) {
        throw new UnprocessableEntityException("The version in production cannot be changed")
      }

      const fields = { revisionName, revisionDesc, isDraft: false }
      const updated = await this.agentSettingsConnectRepository.updateOneById({
        connectScope,
        id: found.id,
        fields,
      })
      if (!updated) return undefined

      const hasProduction = (await this.findProduction({ connectScope, agentId })) !== undefined
      if (setAsProduction || !hasProduction) {
        await this.agentSettingsRepository.setProduction(connectScope, {
          agentId,
          agentSettingsId: found.id,
        })
        return { ...found, ...fields, isProduction: true }
      }
      return { ...found, ...fields }
    })
  }

  /**
   * Saves the agent's draft as a version and never puts it in production, even when the agent
   * has no version in production yet: a person chooses that version in the studio. Returns
   * undefined when the agent has no draft.
   */
  async saveDraft({
    connectScope,
    agentId,
    revisionName,
    revisionDesc,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revisionName?: string
    revisionDesc?: string
  }): Promise<AgentSettings | undefined> {
    return this.transactionService.run(async () => {
      const draft = await this.agentSettingsRepository.findLatest(connectScope, agentId)
      if (!draft?.isDraft || draft.isArchived) return undefined

      const fields = { revisionName, revisionDesc, isDraft: false }
      const updated = await this.agentSettingsConnectRepository.updateOneById({
        connectScope,
        id: draft.id,
        fields,
      })
      if (!updated) return undefined
      return { ...draft, ...fields }
    })
  }

  /** Puts a saved version in production. Every live channel runs it from the next session on. */
  async setProduction({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
  }): Promise<void> {
    await this.transactionService.run(async () => {
      const target = await this.get({ connectScope, agentId, revision })
      if (!target) {
        throw new NotFoundException(`Version ${revision} not found for agent ${agentId}`)
      }
      if (target.isDraft) {
        throw new UnprocessableEntityException("Save the draft before putting it in production")
      }
      if (target.isArchived) {
        throw new UnprocessableEntityException(`Version ${revision} is archived`)
      }
      if (target.isProduction) return
      await this.agentSettingsRepository.setProduction(connectScope, {
        agentId,
        agentSettingsId: target.id,
      })
    })
  }

  async archive({
    connectScope,
    agentId,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    revision: number
  }): Promise<{ success: boolean }> {
    const found = await this.agentSettingsConnectRepository.find(connectScope, {
      where: { agentId, revision },
    })
    if (!found || found.length !== 1) return { success: false }
    if (!found[0] || found[0].isDraft) return { success: false }
    if (found[0].isProduction) {
      throw new UnprocessableEntityException("The version in production cannot be archived")
    }

    const last = await this.agentSettingsRepository.findLatest(connectScope, agentId)
    if (last && last.revision === revision)
      throw new UnprocessableEntityException("Cannot archive the last revision")

    return this.agentSettingsConnectRepository.updateOneById({
      connectScope,
      id: found[0].id,
      fields: { isArchived: true },
    })
  }

  async updateSettings({
    connectScope,
    agentId,
    agentSettings,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettings: Partial<AgentSettingsUpdateFields>
  }): Promise<AgentSettings> {
    const last = await this.agentSettingsRepository.findLatest(connectScope, agentId)
    let previousSettings:
      | Omit<
          AgentSettings,
          | "id"
          | "createdAt"
          | "updatedAt"
          | "deletedAt"
          | "revisionName"
          | "revisionDesc"
          | "isProduction"
        >
      | undefined
    let revision: number
    let isDraft: boolean = false
    if (last) {
      if (
        !requiresUpdateAgentSettings({
          initialAgentSettings: last,
          modifiedAgentSettings: {
            ...agentSettings,
            ...(agentSettings.deletedTemperature !== undefined && {
              deletedTemperature: agentSettings.deletedTemperature,
            }),
          },
        })
      ) {
        // Nothing to write. A draft that already equals the newest saved revision still goes
        // away: restoring that revision over such a draft must leave none.
        if (!last.isDraft) return last
        return (await this.discardDraftWithoutChanges({ connectScope, draft: last })) ?? last
      }

      isDraft = last.isDraft
      if (isDraft) revision = last.revision
      else {
        const rev = await this.getMaxRevision(agentId)
        revision = rev + 1
      }

      const {
        id,
        createdAt,
        updatedAt,
        deletedAt,
        revisionName,
        revisionDesc,
        isProduction,
        ...cleanedSettings
      } = last
      previousSettings = cleanedSettings
    } else {
      const rev = await this.getMaxRevision(agentId)
      revision = rev + 1
    }

    if (isDraft && last) {
      await this.agentSettingsConnectRepository.updateOneById({
        connectScope,
        id: last.id,
        fields: {
          ...agentSettings,
        },
      })
      const updated = await this.agentSettingsConnectRepository.getOneById(connectScope, last.id)
      if (!updated) {
        throw new NotFoundException(`AgentSettings with id ${last.id} not found`)
      }
      const latestSaved = await this.discardDraftWithoutChanges({ connectScope, draft: updated })
      return latestSaved ?? updated
    } else {
      return await this.agentSettingsConnectRepository.createAndSave(connectScope, {
        ...(previousSettings ?? {}),
        ...agentSettings,
        revision,
        agentId,
        isDraft: true,
      })
    }
  }

  /**
   * Deletes a draft that holds the same settings as the newest saved revision, and returns that
   * revision: an edit the author took back, or a restore of that revision, leaves no draft behind.
   * The newest saved revision is the one the draft was copied from and the one the editor shows
   * once the draft is gone, whichever revision is in production: comparing with an older
   * production revision would delete a restore of it and bring the newer settings back.
   *
   * What ran on the draft (a playground session, a run) moves to that revision first: it holds
   * the same settings, and deleting the draft would otherwise delete those sessions with it. The
   * draft stays when the agent was never saved: it is its only revision.
   */
  private async discardDraftWithoutChanges({
    connectScope,
    draft,
  }: {
    connectScope: RequiredConnectScope
    draft: AgentSettings
  }): Promise<AgentSettings | undefined> {
    const latestSaved = await this.agentSettingsRepository.findLatestSaved(
      connectScope,
      draft.agentId,
    )
    if (!latestSaved || !hasSameAgentSettings(latestSaved, draft)) return undefined

    // One unit: the lock on the draft holds back a session that starts on it and another edit
    // of it, so nothing can point at the draft between the move and the delete, and what the
    // comparison reads is what the delete acts on.
    const isDeleted = await this.transactionService.run(async () => {
      const lockedDraft = await this.agentSettingsRepository.findDraftForUpdate(
        connectScope,
        draft.id,
      )
      if (!lockedDraft || !hasSameAgentSettings(latestSaved, lockedDraft)) return false
      await this.agentSettingsRepository.moveRunsToRevision({
        fromAgentSettingsId: lockedDraft.id,
        toAgentSettingsId: latestSaved.id,
      })
      await this.agentSettingsRepository.deleteDraft(connectScope, lockedDraft.id)
      return true
    })
    return isDeleted ? latestSaved : undefined
  }

  async updateAllSettings({
    connectScope,
    agentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    fieldsToUpdate: AgentSettingsUpdateFields &
      DocumentTagsUpdateFields &
      AgentProjectCategoriesUpdateFields &
      AgentResourceLibrariesUpdateFields
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const { tagsToAdd, tagsToRemove, projectAgentSessionCategoryIds, ...fields } = fieldsToUpdate

    let agentSettingsFieldsToUpdate = extractAgentSettingsUpdateFields(fields)

    agentSettingsFieldsToUpdate = {
      ...agentSettingsFieldsToUpdate,
      ...(agentSettingsFieldsToUpdate.greetingMessage !== undefined && {
        greetingMessage: this.normalizeGreetingMessage(agentSettingsFieldsToUpdate.greetingMessage),
      }),
    }

    const needsTags =
      agentSettingsFieldsToUpdate.documentsRagMode !== undefined ||
      fieldsToUpdate.tagsToAdd !== undefined ||
      fieldsToUpdate.tagsToRemove !== undefined
    const needsResourceLibraries = fieldsToUpdate.resourceLibraryIds !== undefined
    const relationsToLoad = [
      ...(needsTags ? ["documentTags"] : []),
      ...(needsResourceLibraries ? ["resourceLibraries"] : []),
    ]

    const agent = await this.agentConnectRepository.getOneById(
      connectScope,
      agentId,
      relationsToLoad.length > 0 ? { relations: relationsToLoad } : undefined,
    )
    if (!agent) {
      throw new NotFoundException(`Agent with id ${agentId} not found`)
    }

    const agentSettings = await this.getLatest({ connectScope, agentId })

    const nextOutputJsonSchema =
      agentSettingsFieldsToUpdate.outputJsonSchema !== undefined
        ? agentSettingsFieldsToUpdate.outputJsonSchema
        : agentSettings.outputJsonSchema

    this.validateExtractionAgent({
      type: agent.type,
      outputJsonSchema: nextOutputJsonSchema,
    })

    const nextFillFormEnabled =
      agentSettingsFieldsToUpdate.fillFormEnabled !== undefined
        ? agentSettingsFieldsToUpdate.fillFormEnabled
        : agentSettings.fillFormEnabled

    this.validateFillFormAgent({
      fillFormEnabled: nextFillFormEnabled,
      outputJsonSchema: nextOutputJsonSchema,
    })

    if (agentSettingsFieldsToUpdate.embeddingModel !== undefined) {
      await this.validateEmbeddingModel({
        connectScope,
        embeddingModel: agentSettingsFieldsToUpdate.embeddingModel,
      })
    }

    if (needsTags) {
      const currentTags = agent.documentTags ?? []
      agent.documentTags = await this.resolveDocumentTags({
        connectScope,
        currentTags,
        tagsToAdd,
        tagsToRemove,
      })
    }

    if (needsResourceLibraries) {
      agent.resourceLibraries = await this.resolveResourceLibraries({
        connectScope,
        resourceLibraryIds: fieldsToUpdate.resourceLibraryIds,
        agentType: agent.type,
      })
    }

    if (fieldsToUpdate.projectAgentSessionCategoryIds !== undefined) {
      const selectedProjectCategories = await this.resolveProjectAgentSessionCategories({
        projectId: connectScope.projectId,
        projectAgentSessionCategoryIds: fieldsToUpdate.projectAgentSessionCategoryIds,
        withDeleted: true,
      })
      await this.agentSessionCategoriesService.replaceActiveCategoriesForAgent(
        agent.id,
        selectedProjectCategories,
      )
    }

    const updatedAgent = await this.agentConnectRepository.saveOne(agent)
    updatedAgent.sessionCategories =
      await this.agentSessionCategoriesService.listActiveCategoriesForAgent(agent.id)

    const updatedAgentSettings = await this.updateSettings({
      connectScope,
      agentId: agent.id,
      agentSettings: {
        ...extractAgentSettingsUpdateFields(agentSettings),
        // `agentSettingsFieldsToUpdate.greetingMessage` is already normalized above and is only
        // present when the caller provided it, so omitting a per-tab field preserves the existing
        // greeting instead of wiping it. Sending `null` clears it.
        ...agentSettingsFieldsToUpdate,
      },
    })

    return { agent: updatedAgent, agentSettings: updatedAgentSettings }
  }

  validateExtractionAgent({
    type,
    outputJsonSchema,
  }: {
    type: Agent["type"]
    outputJsonSchema: AgentSettings["outputJsonSchema"]
  }): void {
    if (type === "extraction" && !outputJsonSchema) {
      throw new UnprocessableEntityException("Extraction agent requires outputJsonSchema")
    }
  }

  /** A model is only selectable once the project enabled it and finished embedding with it. */
  async validateEmbeddingModel({
    connectScope,
    embeddingModel,
  }: {
    connectScope: RequiredConnectScope
    embeddingModel: AgentSettings["embeddingModel"]
  }): Promise<void> {
    const completedModelNames =
      await this.projectEmbeddingModelsService.listCompletedModelNames(connectScope)
    if (!completedModelNames.includes(embeddingModel)) {
      throw new UnprocessableEntityException(
        `Embedding model ${embeddingModel} is not ready for this project yet`,
      )
    }
  }

  /** The model a new agent searches with when its creator picks none. */
  async resolveDefaultEmbeddingModel(connectScope: RequiredConnectScope): Promise<EmbeddingModel> {
    return this.projectEmbeddingModelsService.resolveDefaultModelName(connectScope)
  }

  validateFillFormAgent({
    fillFormEnabled,
    outputJsonSchema,
  }: {
    fillFormEnabled: AgentSettings["fillFormEnabled"]
    outputJsonSchema: AgentSettings["outputJsonSchema"]
  }): void {
    if (fillFormEnabled && !outputJsonSchema) {
      throw new UnprocessableEntityException(
        "outputJsonSchema is required when the fillForm tool is enabled",
      )
    }
  }

  async resolveDocumentTags({
    connectScope,
    currentTags,
    tagsToAdd,
    tagsToRemove,
  }: {
    connectScope: RequiredConnectScope
    currentTags: Agent["documentTags"]
    tagsToAdd?: string[]
    tagsToRemove?: string[]
  }) {
    return await this.documentTagsService.resolveTagChanges({
      connectScope,
      currentTags,
      tagsToAdd,
      tagsToRemove,
    })
  }

  async resolveResourceLibraries({
    connectScope,
    resourceLibraryIds,
    agentType,
  }: {
    connectScope: RequiredConnectScope
    resourceLibraryIds?: string[]
    agentType: Agent["type"]
  }): Promise<ResourceLibrary[]> {
    if (!resourceLibraryIds || resourceLibraryIds.length === 0) return []

    if (agentType !== "conversation") {
      throw new UnprocessableEntityException(
        "Resource libraries can only be attached to conversation agents",
      )
    }

    const uniqueIds = [...new Set(resourceLibraryIds)]
    const resourceLibraries = await this.resourceLibrariesService.findResourceLibrariesByIds({
      connectScope,
      ids: uniqueIds,
    })

    if (resourceLibraries.length !== uniqueIds.length) {
      throw new UnprocessableEntityException("One or more resource libraries do not exist")
    }

    return resourceLibraries
  }

  async resolveProjectAgentSessionCategories({
    projectId,
    projectAgentSessionCategoryIds,
    withDeleted,
  }: {
    projectId: string
    projectAgentSessionCategoryIds: string[]
    withDeleted: boolean
  }): Promise<Array<Pick<ProjectAgentSessionCategory, "id" | "name">>> {
    if (projectAgentSessionCategoryIds.length === 0) {
      return []
    }

    const uniqueProjectAgentSessionCategoryIds = [...new Set(projectAgentSessionCategoryIds)]
    const projectCategories = await this.projectAgentSessionCategoryRepository.find({
      where: {
        id: In(uniqueProjectAgentSessionCategoryIds),
        projectId,
      },
      withDeleted,
      order: { name: "ASC" },
    })

    if (projectCategories.length !== uniqueProjectAgentSessionCategoryIds.length) {
      throw new UnprocessableEntityException("One or more session categories do not exist")
    }

    return projectCategories.map((projectCategory) => ({
      id: projectCategory.id,
      name: projectCategory.name,
    }))
  }

  normalizeGreetingMessage(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }

  async getAvailableModels(connectScope: RequiredConnectScope): Promise<AvailableModels> {
    return this.agentModelsService.getAvailableModelsForFeatures(
      await this.listEnabledFeatures(connectScope),
    )
  }

  async assertModelAvailable({
    connectScope,
    model,
  }: {
    connectScope: RequiredConnectScope
    model: string
  }): Promise<void> {
    this.agentModelsService.assertAvailable({
      features: await this.listEnabledFeatures(connectScope),
      model,
    })
  }

  /** The provider options a new agent on `model` stores, once the project may pick that model. */
  async resolveNewAgentModelOptions({
    connectScope,
    model,
    providerOptions,
  }: {
    connectScope: RequiredConnectScope
    model: AgentModel
    providerOptions: Record<string, unknown> | null | undefined
  }): Promise<Record<string, unknown>> {
    await this.assertModelAvailable({ connectScope, model })
    return this.agentModelsService.resolveModelOptions({ model, providerOptions })
  }

  /**
   * The update fields with their model choice checked. Keeping the current model is always
   * allowed, even when the project lost access to it. New options are checked against the model,
   * and a new model without options starts on its defaults, since the options of the previous one
   * may not fit it.
   */
  async checkModelUpdate<
    Fields extends { model?: AgentModel; providerOptions?: Record<string, unknown> | null },
  >({
    connectScope,
    agentId,
    fieldsToUpdate,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    fieldsToUpdate: Fields
  }): Promise<Fields> {
    if (fieldsToUpdate.model === undefined && fieldsToUpdate.providerOptions === undefined)
      return fieldsToUpdate
    const current = await this.getLatest({ connectScope, agentId })
    const model = fieldsToUpdate.model ?? current.model
    const modelChanges =
      fieldsToUpdate.model !== undefined && fieldsToUpdate.model !== current.model
    if (modelChanges) await this.assertModelAvailable({ connectScope, model })
    if (fieldsToUpdate.providerOptions === undefined && !modelChanges) return fieldsToUpdate
    return {
      ...fieldsToUpdate,
      providerOptions: this.agentModelsService.resolveModelOptions({
        model,
        providerOptions: fieldsToUpdate.providerOptions,
      }),
    }
  }

  private listEnabledFeatures(connectScope: RequiredConnectScope) {
    return this.projectRepository.listEnabledFeatures(connectScope.projectId)
  }
}

type AgentProjectCategoriesUpdateFields = {
  projectAgentSessionCategoryIds?: string[]
}

type AgentResourceLibrariesUpdateFields = {
  resourceLibraryIds?: string[]
}
