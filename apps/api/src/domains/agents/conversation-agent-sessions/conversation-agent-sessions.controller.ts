import {
  type ConversationAgentSessionDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { BaseAgentSessionGuard } from "../base-agent-sessions/base-agent-session.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "../base-agent-sessions/base-agent-sessions.service"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { ConversationAgentSession } from "./conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "./conversation-agent-sessions.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, BaseAgentSessionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class ConversationAgentSessionsController {
  constructor(
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
  ) {}

  @CheckPolicy((policy) => policy.canList())
  @Post(ConversationAgentSessionsRoutes.getAll.path)
  async getAll(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof ConversationAgentSessionsRoutes.getAll.request,
  ): Promise<typeof ConversationAgentSessionsRoutes.getAll.response> {
    const sessions = await this.conversationAgentSessionsService.getAllSessionsForAgent({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      userId: request.user.id,
      type: payload.type,
    })
    return { data: sessions.map(toDto(payload.type)) }
  }

  @CheckPolicy((policy) => policy.canCreate())
  @Post(ConversationAgentSessionsRoutes.createOne.path)
  @TrackActivity({ action: "conversationAgentSession.create" })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof ConversationAgentSessionsRoutes.createOne.request,
  ): Promise<typeof ConversationAgentSessionsRoutes.createOne.response> {
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
    })
    const session = await this.conversationAgentSessionsService.createSession({
      connectScope: getRequiredConnectScope(request),
      agentSettingsId: agentSettings.id,
      userId: request.user.id,
      type: payload.type,
    })
    return { data: toDto(payload.type)(session) }
  }

  @Post(ConversationAgentSessionsRoutes.deleteOne.path)
  @AddContext("agentSession")
  @CheckPolicy((policy) => policy.canDelete())
  async deleteOne(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<typeof ConversationAgentSessionsRoutes.deleteOne.response> {
    await this.baseAgentSessionsService.deleteAgentSession({
      agentType: "conversation",
      agentId: request.agent.id,
      agentSession: request.agentSession,
    })
    return { data: { success: true } }
  }
}

function toDto(agentSessionType: BaseAgentSessionType) {
  return (entity: ConversationAgentSession): ConversationAgentSessionDto => {
    const traceUrl = agentSessionType === "live" ? undefined : getTraceUrl(entity.traceId)
    return {
      id: entity.id,
      agentId: entity.agentId,
      type: entity.type,
      ...(entity.title ? { title: entity.title } : {}),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
      traceUrl,
    }
  }
}
