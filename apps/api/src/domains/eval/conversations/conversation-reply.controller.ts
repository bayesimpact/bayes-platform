import type { StreamEvent } from "@caseai-connect/api-contracts"
import { EvalConversationsRoutes } from "@caseai-connect/eval-contracts"
import { Controller, type MessageEvent, Req } from "@nestjs/common"
import { Observable } from "rxjs"
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
import { REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { assertReviewCampaignIsActive } from "@/domains/review-campaigns/review-campaign-status"
import {
  assertTesterSession,
  type EndpointRequestWithTesterSession,
  TESTER_SESSION_CONTEXT,
} from "./conversation.mappers"

/**
 * Sends a message to a tester's conversation in a review campaign and streams the replies, as
 * server-sent events. A copy of the logic of the abstract `StreamingController` of the `agents`
 * domain, with the session type fixed to `review_campaign_tester`. The reply runs
 * on the version of the agent's settings the campaign chose, not the one in production.
 *
 * The schema checks the body before the stream starts: an empty message or a settings version
 * answers 400. A check made in the handler (a closed campaign, a session of another type) comes
 * back as an SSE error frame, as on the playground's stream.
 */
@Controller()
export class EvalConversationReplyController {
  constructor(
    private readonly streamingLlmService: StreamingLlmService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly activeAgentScopeService: ActiveAgentScopeService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
  ) {}

  @SchemaRoute(EvalConversationsRoutes.streamReply, {
    permission: { key: REVIEW_CAMPAIGN_TESTER_SESSION_CREATE_PERMISSION, on: "review_campaign" },
    context: [...TESTER_SESSION_CONTEXT],
  })
  streamReply(
    @Req() request: EndpointRequestWithTesterSession,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationsRoutes.streamReply>,
  ): Observable<MessageEvent> {
    assertReviewCampaignIsActive(request.reviewCampaign)
    assertTesterSession(request)

    const { content: userContent, attachmentDocumentId } = payload
    const agent = request.agent
    const session = request.agentSession
    const connectScope = getRequiredConnectScope(request)
    // The version the campaign's managers chose, whatever runs in production meanwhile.
    const campaignAgentSettingsId = request.reviewCampaign.agentSettingsId

    return new Observable<StreamEvent>((subscriber) => {
      void (async () => {
        try {
          const agentSettings = await this.agentSettingsService.getById({
            connectScope,
            agentSettingsId: campaignAgentSettingsId,
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
                // The attachment belongs to the message the tester typed.
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
