import type {
  ConversationAgentSessionDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { toConversationFormDto } from "@/domains/agents/shared/conversation-forms/conversation-form.mapper"
import { getTraceUrl } from "@/external/llm/trace-url"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "../base-agent-sessions/base-agent-sessions.service"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSubAgentsService } from "../sub-agents/agent-sub-agents.service"
import type { ConversationAgentSession } from "./conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "./conversation-agent-sessions.service"

type Routes = (typeof ConversationAgentSessionsRoutes)[BaseAgentSessionType]

/**
 * Base of the live and playground conversation session controllers. Each subclass serves one
 * session type on its own route set and checks its own permissions, and the handlers here only
 * ever see sessions of that type, so a live permission never opens a playground session.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses inherit for
 * dependency injection.
 */
@Injectable()
export abstract class ConversationAgentSessionsController {
  protected abstract readonly type: BaseAgentSessionType

  constructor(
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
    private readonly agentSubAgentsService: AgentSubAgentsService,
  ) {}

  protected async handleGetAll(
    request: EndpointRequestWithAgent,
  ): Promise<Routes["getAll"]["response"]> {
    const sessions = await this.conversationAgentSessionsService.getAllSessionsForAgent({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      userId: request.user.id,
      type: this.type,
    })
    const formSchemas = await this.resolveFormSchemas({
      connectScope: getRequiredConnectScope(request),
      sessions,
    })
    return { data: sessions.map(toDto(this.type, formSchemas)) }
  }

  protected async handleCreateOne(
    request: EndpointRequestWithAgent,
  ): Promise<Routes["createOne"]["response"]> {
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
    })
    const session = await this.conversationAgentSessionsService.createSession({
      connectScope: getRequiredConnectScope(request),
      agentSettingsId: agentSettings.id,
      userId: request.user.id,
      type: this.type,
    })
    return { data: toDto(this.type, new Map())(session) }
  }

  protected async handleDeleteOne(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<Routes["deleteOne"]["response"]> {
    if (request.agentSession.type !== this.type) throw new NotFoundException()

    await this.baseAgentSessionsService.deleteAgentSession({
      agentType: "conversation",
      agentId: request.agent.id,
      agentSession: request.agentSession,
    })
    return { data: { success: true } }
  }

  protected async handleListSubSessions(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
  ): Promise<Routes["listSubSessions"]["response"]> {
    if (request.agentSession.type !== this.type) throw new NotFoundException()

    const connectScope = getRequiredConnectScope(request)

    const [subAgents, sessions] = await Promise.all([
      this.agentSubAgentsService.listSubAgents({ connectScope, parentAgent: request.agent }),
      this.conversationAgentSessionsService.listSubSessions({
        connectScope,
        parentSessionId: request.agentSession.id,
        userId: request.user.id,
        type: this.type,
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
            session: toDto(this.type, formSchemas)(session),
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
