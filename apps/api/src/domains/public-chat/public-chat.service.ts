import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAppHtmlService } from "@/domains/agents/shared/agent-session-messages/mcp-app-html.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActiveAgentScopeService } from "@/domains/agents/shared/agent-session-messages/streaming/active-agent-scope.service"
import { runHandoffTurns } from "@/domains/agents/shared/agent-session-messages/streaming/handoff-turn-loop"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingLlmService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"

/**
 * Domain operations behind the public chat API. Returns entities and raw values; the
 * per-version controllers (`v1/`, `legacy/`) shape them into their contract's DTOs.
 */
@Injectable()
export class PublicChatService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly publicAgentSessionsService: PublicAgentSessionsService,
    private readonly streamingLLMService: StreamingLlmService,
    private readonly mcpAppHtmlService: McpAppHtmlService,
    private readonly activeAgentScopeService: ActiveAgentScopeService,
  ) {}

  async createSession(
    embedConfig: AgentEmbedConfig,
    externalVisitorId?: string,
  ): Promise<{ session: PublicAgentSession; sessionToken: string }> {
    return this.publicAgentSessionsService.createSession(embedConfig, externalVisitorId)
  }

  /**
   * The session and its transcript, without MCP App HTML: reading that connects to every
   * MCP server the transcript points at, which used to hold the whole widget behind its
   * loading shell. It is served separately by `getMcpAppHtml`.
   */
  async getSession(
    publicSession: PublicAgentSession,
  ): Promise<{ session: PublicAgentSession; messages: AgentMessage[] }> {
    return this.publicAgentSessionsService.getSessionWithMessages(publicSession.id)
  }

  /** Current HTML of every MCP App card the session's replies point at, by cache key. */
  async getMcpAppHtml(publicSession: PublicAgentSession): Promise<Map<string, string>> {
    const { session, messages } = await this.publicAgentSessionsService.getSessionWithMessages(
      publicSession.id,
    )
    return this.mcpAppHtmlService.readLiveHtml({
      agentId: session.agentId,
      sessionId: session.id,
      messages,
      externalVisitorId: session.externalVisitorId,
      // Same published settings as the replies themselves, so the cards come
      // back in the language the visitor was answered in.
      resolveLocale: async () => {
        const agentSettings = await this.agentSettingsService.getLast({
          connectScope: {
            organizationId: publicSession.organizationId,
            projectId: publicSession.projectId,
          },
          agentId: session.agentId,
        })
        return agentSettings.locale
      },
    })
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

    // The agent in control answers, and a hand-over runs the next agent's turn
    // in the same response (see handoff-turn-loop.ts). The public contract is
    // one reply per request (one `start`, one `end`), so the turns of one
    // request are streamed as one reply: later `start` events are dropped, the
    // texts are joined by a blank line, and a single `end` carries the whole
    // text. Each turn is still stored as its own message, attributed to the
    // agent that wrote it, which is what the session read returns.
    const turns = runHandoffTurns({
      userContent,
      resolveActiveAgent: async () =>
        this.activeAgentScopeService.resolve({
          connectScope,
          rootAgent: agent,
          rootAgentSettings: agentSettings,
          activeAgentId: await this.publicAgentSessionsService.getActiveAgentId(publicSession.id),
        }),
      runTurn: ({ active, userContent: turnContent, persistUserMessage }) =>
        this.streamingLLMService.streamPublicAgentResponse({
          connectScope,
          publicSessionId: publicSession.id,
          agent: active.agent,
          agentSettings: active.agentSettings,
          handoff: active.handoff,
          userContent: turnContent,
          persistUserMessage,
          notifyClient,
          // Public sessions persist their title, categories and active agent
          // on public_agent_session; their forms live in conversation_form
          // like every session's.
          sessionState: {
            metadataRecalculator: this.publicAgentSessionsService,
            activeAgent: this.publicAgentSessionsService,
          },
          externalVisitorId: publicSession.externalVisitorId,
        }),
    })
    yield* coalesceTurnsIntoOneReply(turns)
  }
}

/**
 * Folds the events of several turns into the frame of one reply: the first
 * `start`, every `chunk` and `notify_client`, one `end` whose `fullContent` is
 * the texts of the turns joined by a blank line. An `error` ends the reply
 * where it happens, as before.
 */
export async function* coalesceTurnsIntoOneReply(
  turns: AsyncGenerator<StreamEvent, void, unknown>,
): AsyncGenerator<StreamEvent, void, unknown> {
  let messageId: string | undefined
  const texts: string[] = []
  for await (const event of turns) {
    const payload = JSON.parse(String(event.data)) as StreamEventPayload
    switch (payload.type) {
      case "start":
        if (messageId === undefined) {
          messageId = payload.messageId
          yield event
        } else {
          yield toStreamEvent({ type: "chunk", content: "\n\n", messageId })
        }
        break
      case "chunk":
        yield toStreamEvent({
          type: "chunk",
          content: payload.content,
          messageId: messageId ?? payload.messageId,
        })
        break
      case "end":
        texts.push(payload.fullContent)
        break
      case "error":
        yield toStreamEvent({ ...payload, messageId: messageId ?? payload.messageId })
        return
      default:
        yield event
    }
  }
  if (messageId !== undefined) {
    yield toStreamEvent({ type: "end", messageId, fullContent: texts.join("\n\n") })
  }
}

function toStreamEvent(payload: StreamEventPayload): StreamEvent {
  return { data: JSON.stringify(payload) } as StreamEvent
}
