import type {
  CreatePublicSessionResponseDto,
  PublicAgentSessionDto,
  PublicMcpAppHtmlDto,
  StreamEvent,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { toMcpAppHtmlDtos } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingLlmService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"
import { toPublicAgentSessionDto } from "./public-chat.mappers"

@Injectable()
export class PublicChatService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly publicAgentSessionsService: PublicAgentSessionsService,
    private readonly streamingLLMService: StreamingLlmService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
  ) {}

  async createSession(
    embedConfig: AgentEmbedConfig,
    externalVisitorId?: string,
  ): Promise<CreatePublicSessionResponseDto> {
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
    // MCP App HTML is served by `getMcpAppHtml`: reading it connects to every MCP server the
    // transcript points at, which used to hold the whole widget behind its loading shell.
    return toPublicAgentSessionDto(session, messages)
  }

  /** Current HTML of every MCP App card the session's replies point at. */
  async getMcpAppHtml(publicSession: PublicAgentSession): Promise<PublicMcpAppHtmlDto[]> {
    const { session, messages } = await this.publicAgentSessionsService.getSessionWithMessages(
      publicSession.id,
    )
    const htmlByKey = await this.mcpAppHtmlService.readLiveHtml({
      agentId: session.agentId,
      sessionId: session.id,
      messages,
      externalVisitorId: session.externalVisitorId,
    })
    return toMcpAppHtmlDtos(htmlByKey)
  }

  async *streamResponse(
    publicSession: PublicAgentSession,
    userContent: string,
    notifyClient: (event: Extract<StreamEvent, { type: "notify_client" }>) => void,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const agent = await this.agentRepository.findOne({
      where: { id: publicSession.agentId },
      relations: ["resourceLibraries", "sessionCategories"],
    })
    if (!agent) throw new NotFoundException("Agent not found")

    const connectScope = {
      organizationId: publicSession.organizationId,
      projectId: publicSession.projectId,
    }
    // Visitors must be answered by the published settings, never by the draft an
    // author is editing in the agent editor (#636).
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope,
      agentId: publicSession.agentId,
    })

    await this.publicAgentSessionsService.updateLastActivity(publicSession.id)

    yield* this.streamingLLMService.streamPublicAgentResponse({
      connectScope,
      publicSessionId: publicSession.id,
      agent,
      agentSettings,
      userContent,
      notifyClient,
      // Public sessions persist their state on public_agent_session — the
      // same service implements both stateful-tool interfaces.
      sessionState: {
        metadataRecalculator: this.publicAgentSessionsService,
        resultUpdater: this.publicAgentSessionsService,
      },
      sessionResult: publicSession.result ?? null,
      externalVisitorId: publicSession.externalVisitorId,
    })
  }
}
