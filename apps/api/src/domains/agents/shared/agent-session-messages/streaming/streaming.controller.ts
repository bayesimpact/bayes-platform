import { AgentSessionMessagesRoutes, type StreamEvent } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import { Controller, ForbiddenException, Query, Req, Sse, UseGuards } from "@nestjs/common"
import { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingService } from "./streaming.service"
import type { AgentSessionScope } from "./streaming-session.types"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class StreamingController {
  constructor(private readonly chatStreamingService: StreamingService) {}

  @CheckPolicy((policy) => policy.canList())
  @Sse(AgentSessionMessagesRoutes.stream.path, { method: 0 /* GET */ })
  stream(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession | FormAgentSession>,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    try {
      const parsedQuery = JSON.parse(query) as typeof AgentSessionMessagesRoutes.stream.request
      const userContent = parsedQuery.payload.content
      const attachmentDocumentId = parsedQuery.payload.attachmentDocumentId
      const organizationId = request.organizationId
      const projectId = request.project.id
      const agent = request.agent

      const agentSessionScope: AgentSessionScope = {
        connectScope: { organizationId, projectId },
        agent,
        session: request.agentSession,
      }

      if (!userContent) {
        throw new ForbiddenException("Missing user content")
      }

      if (typeof userContent === "string" && !userContent.trim()) {
        throw new ForbiddenException("User content must not be empty")
      }

      return new Observable<StreamEvent>((subscriber) => {
        void (async () => {
          try {
            const events = this.chatStreamingService.streamAgentResponse({
              agentSessionScope,
              userContent,
              attachmentDocumentId,
              notifyClient: (event) => {
                subscriber.next(event)
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
    } catch (_) {
      throw new ForbiddenException("Invalid query format")
    }
  }
}
