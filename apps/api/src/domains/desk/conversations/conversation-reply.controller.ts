import type { StreamEvent } from "@bayes-platform/api-contracts"
import { DeskConversationsRoutes } from "@bayes-platform/desk-contracts"
import { Controller, type MessageEvent, NotFoundException, Req } from "@nestjs/common"
import { Observable } from "rxjs"
import type { EndpointRequestWithConversationAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteInput } from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActiveAgentScopeService } from "@/domains/agents/shared/agent-session-messages/streaming/active-agent-scope.service"
import { runHandoffTurns } from "@/domains/agents/shared/agent-session-messages/streaming/handoff-turn-loop"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingLlmService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service"
import type { AgentSessionScope } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-session.types"
import { AGENT_CONVERSATION_SESSION_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"

/**
 * Sends a message to a live conversation and streams the replies, as server-sent events. A copy
 * of `StreamingController`. The schema checks the body before the stream starts: an empty
 * message answers 400. A check made in the handler comes back as an SSE error frame, as on the
 * playground route.
 */
@Controller()
export class DeskConversationReplyController {
  constructor(
    private readonly streamingLlmService: StreamingLlmService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly activeAgentScopeService: ActiveAgentScopeService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
  ) {}

  @SchemaRoute(DeskConversationsRoutes.streamReply, {
    permission: { key: AGENT_CONVERSATION_SESSION_CREATE_PERMISSION, on: "agent" },
    context: ["organization", "project", "agent", "agentSession"],
  })
  streamReply(
    @Req() request: EndpointRequestWithConversationAgentSession,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskConversationsRoutes.streamReply>,
  ): Observable<MessageEvent> {
    if (request.agentSession.type !== "live") throw new NotFoundException()

    const { content: userContent, attachmentDocumentId } = payload
    const agent = request.agent
    const session = request.agentSession
    const connectScope = getRequiredConnectScope(request)

    return new Observable<StreamEvent>((subscriber) => {
      void (async () => {
        try {
          // A live conversation runs the version in production.
          const agentSettings = await this.agentSettingsService.getProduction({
            connectScope,
            agentId: agent.id,
          })

          // The agent in control answers: the conversation's agent, or the sub-agent a hand-over
          // gave it to. It is read again after each turn, so a hand-over or a conclusion runs the
          // next agent's turn in the same response (see handoff-turn-loop.ts).
          const events = runHandoffTurns({
            userContent,
            resolveActiveAgent: async () => {
              const current = await this.conversationAgentSessionsService.findById({
                connectScope,
                id: session.id,
              })
              return this.activeAgentScopeService.resolve({
                connectScope,
                rootAgent: agent,
                rootAgentSettings: agentSettings,
                activeAgentId: current?.activeAgentId ?? null,
              })
            },
            runTurn: ({ active, userContent: turnContent, persistUserMessage }) => {
              const agentSessionScope: AgentSessionScope = {
                connectScope,
                agent: active.agent,
                agentSettings: active.agentSettings,
                session,
                handoff: active.handoff,
              }
              return this.streamingLlmService.streamAgentResponse({
                agentSessionScope,
                userContent: turnContent,
                // The attachment belongs to the message the person typed.
                attachmentDocumentId: persistUserMessage ? attachmentDocumentId : undefined,
                persistUserMessage,
                notifyClient: (event) => {
                  subscriber.next(event)
                },
              })
            },
          })

          for await (const event of events) {
            subscriber.next(event)
          }

          subscriber.complete()
        } catch (error) {
          subscriber.error(error)
        }
      })()
    })
  }
}
