import type {
  AgentEmbedConfigDto,
  PublicAgentSessionDto,
  PublicSessionMessageDto,
  StreamEvent,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.service"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentEmbedConfigsService } from "./agent-embed-configs/agent-embed-configs.service"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"

@Injectable()
export class PublicChatService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    readonly agentEmbedConfigsService: AgentEmbedConfigsService,
    private readonly publicAgentSessionsService: PublicAgentSessionsService,
    private readonly streamingService: StreamingService,
  ) {}

  async createSession(
    embedConfig: AgentEmbedConfig,
    externalVisitorId?: string,
  ): Promise<{ sessionId: string; sessionToken: string }> {
    const { session, sessionToken } = await this.publicAgentSessionsService.createSession(
      embedConfig,
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
    userContent: string,
    notifyClient: (event: Extract<StreamEvent, { type: "notify_client" }>) => void,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const agent = await this.agentRepository.findOne({
      where: { id: publicSession.agentId },
    })
    if (!agent) throw new NotFoundException("Agent not found")

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

  toEmbedConfigDto(embedConfig: AgentEmbedConfig): AgentEmbedConfigDto {
    return {
      id: embedConfig.id,
      agentId: embedConfig.agentId,
      embedToken: embedConfig.embedToken,
      isEnabled: embedConfig.isEnabled,
      allowedOrigins: embedConfig.allowedOrigins,
      title: embedConfig.title,
      logoUrl: embedConfig.logoUrl,
      primaryColor: embedConfig.primaryColor,
      displayMode: embedConfig.displayMode,
      createdAt: embedConfig.createdAt.getTime(),
      updatedAt: embedConfig.updatedAt.getTime(),
    }
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
