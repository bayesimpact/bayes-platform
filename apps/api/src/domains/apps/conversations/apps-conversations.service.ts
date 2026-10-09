import { AGENT_READ_PERMISSION } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository, type AgentSummary } from "@/domains/agents/agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  type AppConversationRecord,
  PublicAgentSessionRepository,
} from "@/domains/public-chat/public-agent-sessions/public-agent-session.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "@/domains/public-chat/public-chat.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"

/**
 * Conversations an installed App opens with the agents of its project, on behalf of
 * people outside the platform. They are public agent sessions tied to the
 * installation, answered with the published settings like the embed.
 */
@Injectable()
export class AppsConversationsService {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly agentRepository: AgentRepository,
    private readonly publicAgentSessionRepository: PublicAgentSessionRepository,
    private readonly publicChatService: PublicChatService,
  ) {}

  async listAgents({
    userId,
    connectScope,
  }: {
    userId: string
    connectScope: RequiredConnectScope
  }): Promise<AgentSummary[]> {
    const agentIds = await this.permissionService.listResourceIds(userId, AGENT_READ_PERMISSION)
    return this.agentRepository.findConversationSummariesByIds(connectScope.projectId, agentIds)
  }

  async createConversation({
    connectScope,
    appInstallationId,
    agentId,
    externalUserId,
  }: {
    connectScope: RequiredConnectScope
    appInstallationId: string
    agentId: string
    externalUserId: string
  }): Promise<AppConversationRecord> {
    const agent = await this.agentRepository.findConversationSummaryInProject(
      connectScope.projectId,
      agentId,
    )
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`)

    return this.publicAgentSessionRepository.createAppSession({
      connectScope,
      agentId: agent.id,
      appInstallationId,
      externalVisitorId: externalUserId,
    })
  }

  async sendMessage({
    connectScope,
    appInstallationId,
    agentId,
    conversationId,
    content,
  }: {
    connectScope: RequiredConnectScope
    appInstallationId: string
    agentId: string
    conversationId: string
    content: string
  }): Promise<{ messageId: string; content: string }> {
    return this.publicChatService.replyToAppConversation({
      connectScope,
      appInstallationId,
      agentId,
      conversationId,
      content,
    })
  }
}
