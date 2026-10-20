import { duplicateAgentSchema } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMcpServerRepository } from "@/domains/mcp-servers/agent-mcp-server.repository"
import type { Agent } from "./agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "./agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionCategoryRepository } from "./session-categories/agent-session-category.repository"
import { toAgentSettingsFields } from "./settings/agent.settings.functions"
import type { AgentSettings } from "./settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsRepository } from "./settings/agent-settings.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSubAgentRepository } from "./sub-agents/agent-sub-agent.repository"

/**
 * Copies an agent into a new agent of its project, for someone who wants a variant of it.
 *
 * The copy takes the published settings, the MCP servers, the sub-agents, the sources (document
 * tags and resource libraries) and the conversation categories, under a new name. Its settings
 * are a draft: no live conversation runs it until someone publishes it in the studio. Sessions,
 * memories, analytics, the embed settings and token, members, review campaigns and evaluations
 * stay with the original. The person who copies owns the copy, and the project admins administer
 * it, as for an agent created from scratch.
 */
@Injectable()
export class AgentDuplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly agentRepository: AgentRepository,
    private readonly agentSettingsRepository: AgentSettingsRepository,
    private readonly agentSessionCategoryRepository: AgentSessionCategoryRepository,
    private readonly agentSubAgentRepository: AgentSubAgentRepository,
    private readonly agentMcpServerRepository: AgentMcpServerRepository,
    private readonly agentMembershipsService: AgentMembershipsService,
  ) {}

  async duplicateAgent({
    connectScope,
    agentId,
    name,
    userId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    name: string
    userId: string
  }): Promise<{ agent: Agent; agentSettings: AgentSettings }> {
    const parsed = duplicateAgentSchema.safeParse({ name })
    if (!parsed.success) {
      throw new UnprocessableEntityException(
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"),
      )
    }
    const copyName = parsed.data.name

    return this.transactionService.run(async () => {
      const source = await this.agentRepository.findDuplicationSource(connectScope, agentId)
      if (!source) {
        throw new NotFoundException(`Agent with id ${agentId} not found`)
      }
      // An agent that was never published has only its draft to give.
      const sourceSettings =
        (await this.agentSettingsRepository.findLatestPublished(connectScope, agentId)) ??
        (await this.agentSettingsRepository.findLatest(connectScope, agentId))
      if (!sourceSettings) {
        throw new NotFoundException(`AgentSettings with agentId ${agentId} not found`)
      }

      const agent = await this.agentRepository.createAgent(connectScope, {
        name: copyName,
        type: source.type,
        documentTagIds: source.documentTagIds,
        resourceLibraryIds: source.resourceLibraryIds,
      })
      const agentSettings = await this.agentSettingsRepository.createDraft(connectScope, {
        ...toAgentSettingsFields(sourceSettings),
        agentId: agent.id,
        revision: 1,
      })

      const copy = { fromAgentId: agentId, toAgentId: agent.id }
      await this.agentSessionCategoryRepository.copyActiveCategories(copy)
      await this.agentMcpServerRepository.copyAgentServers(copy)
      await this.agentSubAgentRepository.copySubAgents({
        fromParentAgentId: agentId,
        toParentAgentId: agent.id,
      })

      await this.agentMembershipsService.createAgentOwnerMembership({ agentId: agent.id, userId })
      await this.agentMembershipsService.createAdminAgentMembershipsForProjectAdmins({
        agentId: agent.id,
        projectId: connectScope.projectId,
        excludeUserId: userId,
      })

      return { agent, agentSettings }
    })
  }
}
