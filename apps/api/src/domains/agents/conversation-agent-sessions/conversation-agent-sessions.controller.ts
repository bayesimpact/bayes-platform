import {
  type ConversationAgentSessionDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { toConversationFormDto } from "@/domains/agents/shared/conversation-forms/conversation-form.mapper"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { BaseAgentSessionGuard } from "../base-agent-sessions/base-agent-session.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "../base-agent-sessions/base-agent-sessions.service"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSubAgentsService } from "../sub-agents/agent-sub-agents.service"
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
    private readonly agentSubAgentsService: AgentSubAgentsService,
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
    const formSchemas = await this.resolveFormSchemas({
      connectScope: getRequiredConnectScope(request),
      sessions,
    })
    return { data: sessions.map(toDto(payload.type, formSchemas)) }
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
    return { data: toDto(payload.type, new Map())(session) }
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

  @CheckPolicy((policy) => policy.canList())
  @Post(ConversationAgentSessionsRoutes.listSubSessions.path)
  async listSubSessions(
    @Req() request: EndpointRequestWithAgent,
    @Param("agentSessionId") agentSessionId: string,
    @Body() { payload }: typeof ConversationAgentSessionsRoutes.listSubSessions.request,
  ): Promise<typeof ConversationAgentSessionsRoutes.listSubSessions.response> {
    const connectScope = getRequiredConnectScope(request)

    const [subAgents, sessions] = await Promise.all([
      this.agentSubAgentsService.listSubAgents({ connectScope, parentAgent: request.agent }),
      this.conversationAgentSessionsService.listSubSessions({
        connectScope,
        parentSessionId: agentSessionId,
        userId: request.user.id,
        type: payload.type,
      }),
    ])

    const sessionByAgentId = new Map(sessions.map((session) => [session.agentId, session]))
    const formSchemas = await this.resolveFormSchemas({ connectScope, sessions })

    const results = await Promise.all(
      subAgents.map(async (subAgent) => {
        const session = sessionByAgentId.get(subAgent.childAgentId)
        if (!session || !subAgent.childAgent) return []

        const settings = await this.agentSettingsService.getLast({
          connectScope,
          agentId: subAgent.childAgentId,
        })
        // Only fillForm-enabled sub-agents accumulate a form worth surfacing.
        if (!settings.fillFormEnabled) return []

        return [
          {
            toolName: subAgent.toolName,
            agentId: subAgent.childAgentId,
            agentName: subAgent.childAgent.name,
            outputJsonSchema: settings.outputJsonSchema ?? undefined,
            session: toDto(payload.type, formSchemas)(session),
          },
        ]
      }),
    )

    return { data: results.flat() }
  }

  /**
   * The current form schema of every agent that filled a form in these
   * sessions (the session's agent, or a sub-agent that took the conversation
   * over): the Studio renders each form with its own agent's fields.
   */
  private async resolveFormSchemas({
    connectScope,
    sessions,
  }: {
    connectScope: RequiredConnectScope
    sessions: ConversationAgentSession[]
  }): Promise<Map<string, Record<string, unknown> | null>> {
    const agentIds = new Set(
      sessions.flatMap((session) => (session.forms ?? []).map((form) => form.agentId)),
    )
    const entries = await Promise.all(
      [...agentIds].map(async (agentId) => {
        const settings = await this.agentSettingsService.getLast({ connectScope, agentId })
        return [agentId, settings.fillFormEnabled ? settings.outputJsonSchema : null] as const
      }),
    )
    return new Map(entries)
  }
}

function toDto(
  agentSessionType: BaseAgentSessionType,
  /** The current form schema of each agent that has forms in these sessions. */
  formSchemas: Map<string, Record<string, unknown> | null>,
) {
  return (entity: ConversationAgentSession): ConversationAgentSessionDto => {
    // FIXME: should use this.permissionService.listGlobalPermissions(user.id) to determine if the user can view the trace
    const traceUrl = agentSessionType === "live" ? undefined : getTraceUrl(entity.traceId)
    return {
      id: entity.id,
      agentId: entity.agentId,
      type: entity.type,
      ...(entity.title ? { title: entity.title } : {}),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
      traceUrl,
      // Loaded with the session where the list is built; a session just
      // created has none yet.
      forms: (entity.forms ?? []).map((form) =>
        toConversationFormDto(form, formSchemas.get(form.agentId)),
      ),
      ...(entity.activeAgentId ? { activeAgentId: entity.activeAgentId } : {}),
    }
  }
}
