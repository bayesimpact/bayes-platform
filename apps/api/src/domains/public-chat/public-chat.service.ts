import type {
  PublicAgentSessionDto,
  PublicSessionMessageDto,
  StreamEvent,
} from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.service"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"

@Injectable()
export class PublicChatService {
  constructor(
    private readonly publicAgentSessionsService: PublicAgentSessionsService,
    private readonly streamingService: StreamingService,
  ) {}

  async createSession(
    agent: Agent,
    externalVisitorId?: string,
  ): Promise<{ sessionId: string; sessionToken: string }> {
    const { session, sessionToken } = await this.publicAgentSessionsService.createSession(
      agent,
      externalVisitorId,
    )
    return { sessionId: session.id, sessionToken }
  }

  async getSession(publicSession: PublicAgentSession): Promise<PublicAgentSessionDto> {
    const { session, messages } = await this.publicAgentSessionsService.getSessionWithMessages(
      publicSession.id,
    )
    return this.toSessionDto(session, messages)
  }

  async *streamResponse(
    publicSession: PublicAgentSession,
    agent: Agent,
    userContent: string,
    notifyClient: (event: Extract<StreamEvent, { type: "notify_client" }>) => void,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    await this.publicAgentSessionsService.updateLastActivity(publicSession.id)

    yield* this.streamingService.streamPublicAgentResponse({
      connectScope: {
        organizationId: publicSession.organizationId,
        projectId: publicSession.projectId,
      },
      publicSessionId: publicSession.id,
      agent,
      userContent,
      notifyClient,
    })
  }

  private toSessionDto(
    session: PublicAgentSession,
    messages: AgentMessage[],
  ): PublicAgentSessionDto {
    return {
      id: session.id,
      agentId: session.agentId,
      messages: messages.map(
        (message): PublicSessionMessageDto => ({
          id: message.id,
          role: message.role,
          content: message.content,
          status: message.status ?? undefined,
          createdAt: message.createdAt.getTime(),
        }),
      ),
      createdAt: session.createdAt.getTime(),
    }
  }
}
