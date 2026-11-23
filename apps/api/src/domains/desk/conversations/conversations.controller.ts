import { DeskAgentSessionsRoutes, DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { Controller, NotFoundException, Req } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithConversationAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "@/domains/agents/base-agent-sessions/base-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import {
  AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_DELETE_PERMISSION,
  AGENT_CONVERSATION_SESSION_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import {
  type ConversationSessionRecord,
  type FormSchemasByAgentId,
  toConversationSessionDto,
} from "./conversation.mappers"

/**
 * The live conversations of the signed-in person with a conversation agent: the history, a new
 * conversation, and its deletion. A copy of `LiveConversationAgentSessionsController`.
 */
@Controller()
export class DeskConversationsController {
  constructor(
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
  ) {}

  @SchemaRoute(DeskAgentSessionsRoutes.getConversations, {
    permission: { key: AGENT_CONVERSATION_SESSION_READ_PERMISSION, on: "agent" },
    context: ["organization", "project", "agent"],
  })
  async getConversations(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskAgentSessionsRoutes.getConversations>> {
    const connectScope = getRequiredConnectScope(request)
    const sessions = await this.conversationAgentSessionsService.getAllSessionsForAgent({
      connectScope,
      agentId: request.agent.id,
      userId: request.user.id,
      type: "live",
    })
    const formSchemas = await this.resolveFormSchemas({ connectScope, sessions })
    return { data: sessions.map((session) => toConversationSessionDto(session, formSchemas)) }
  }

  @SchemaRoute(DeskConversationsRoutes.createOne, {
    permission: { key: AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: ["organization", "project", "agent"],
    activity: { action: "conversationAgentSession.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.createOne>> {
    const connectScope = getRequiredConnectScope(request)
    // A live conversation runs the version in production, from its greeting on.
    const agentSettings = await this.agentSettingsService.getProduction({
      connectScope,
      agentId: request.agent.id,
    })
    const session = await this.conversationAgentSessionsService.createSession({
      connectScope,
      agentSettingsId: agentSettings.id,
      userId: request.user.id,
      type: "live",
    })
    return { data: { id: session.id } }
  }

  @SchemaRoute(DeskConversationsRoutes.deleteOne, {
    permission: { key: AGENT_CONVERSATION_SESSION_DELETE_PERMISSION, on: "agent" },
    context: ["organization", "project", "agent", "agentSession"],
  })
  async deleteOne(
    @Req() request: EndpointRequestWithConversationAgentSession,
  ): Promise<SchemaRouteResponse<typeof DeskConversationsRoutes.deleteOne>> {
    if (request.agentSession.type !== "live") throw new NotFoundException()

    await this.baseAgentSessionsService.deleteAgentSession({
      agentType: "conversation",
      agentId: request.agent.id,
      agentSession: request.agentSession,
    })
    return { data: { success: true } }
  }

  /**
   * The form schema, in the version in production, of every agent that filled a form in these
   * conversations (the conversation's agent, or a sub-agent that took it over): each form renders
   * with its own agent's fields.
   */
  private async resolveFormSchemas({
    connectScope,
    sessions,
  }: {
    connectScope: RequiredConnectScope
    sessions: ConversationSessionRecord[]
  }): Promise<FormSchemasByAgentId> {
    const agentIds = new Set(
      sessions.flatMap((session) => (session.forms ?? []).map((form) => form.agentId)),
    )
    const entries = await Promise.all(
      [...agentIds].map(async (agentId) => {
        const settings = await this.agentSettingsService.getProduction({ connectScope, agentId })
        return [agentId, settings.fillFormEnabled ? settings.outputJsonSchema : null] as const
      }),
    )
    return new Map(entries)
  }
}
