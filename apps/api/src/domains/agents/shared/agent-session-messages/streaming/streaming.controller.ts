import type { AgentSessionMessagesRoutes, StreamEvent } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { ConversationAgentSessionType } from "@/domains/agents/base-agent-sessions/base-agent-sessions.types"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActiveAgentScopeService } from "./active-agent-scope.service"
import { runHandoffTurns } from "./handoff-turn-loop"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingLlmService } from "./streaming-llm.service"
import type { AgentSessionScope } from "./streaming-session.types"

/**
 * Base of the live and playground streaming controllers. Each subclass serves one session type on
 * its own route and checks its own permission, and the handler here turns away a session of the
 * other type, so a live permission never streams into a playground session.
 *
 * The rejection comes back as an SSE error frame, like every other check made in the handler: a
 * guard failure is the only one that gets an HTTP status.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses inherit for
 * dependency injection.
 */
@Injectable()
export abstract class StreamingController {
  protected abstract readonly type: ConversationAgentSessionType

  constructor(
    private readonly chatStreamingLLMService: StreamingLlmService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly activeAgentScopeService: ActiveAgentScopeService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
  ) {}

  protected handleStream(
    request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    query: string,
  ): Observable<MessageEvent> {
    if (request.agentSession.type !== this.type) throw new NotFoundException()

    const payload = parseStreamPayload(query)
    const userContent = payload.content
    const attachmentDocumentId = payload.attachmentDocumentId
    const agentSettingsRevision = payload.agentSettingsRevision
    const agent = request.agent
    const session = request.agentSession
    const connectScope = getRequiredConnectScope(request)

    if (!userContent) {
      throw new ForbiddenException("Missing user content")
    }

    if (typeof userContent === "string" && !userContent.trim()) {
      throw new ForbiddenException("User content must not be empty")
    }

    if (agentSettingsRevision !== undefined && session.type !== "playground") {
      throw new ForbiddenException(
        "Choosing a settings version is only available in the playground",
      )
    }

    return new Observable<StreamEvent>((subscriber) => {
      void (async () => {
        try {
          const agentSettings = await this.agentSettingsService.getForSession({
            connectScope,
            agentId: agent.id,
            sessionType: session.type,
            revision: agentSettingsRevision,
          })

          // The agent in control answers: the session's agent, or the
          // sub-agent a handoff gave the conversation to. Re-read after each
          // turn so a hand-over or a conclusion runs the next agent's turn in
          // the same response (see handoff-turn-loop.ts).
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
              return this.chatStreamingLLMService.streamAgentResponse({
                agentSessionScope,
                userContent: turnContent,
                // The attachment belongs to the message the user typed.
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

type StreamPayload =
  (typeof AgentSessionMessagesRoutes)[ConversationAgentSessionType]["stream"]["request"]["payload"]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string"

const isOptionalInteger = (value: unknown): value is number | undefined =>
  value === undefined || Number.isInteger(value)

/**
 * The stream is a GET, so its payload travels JSON-encoded in `?q=`. Only the parse is guarded:
 * a wider try would rewrite every downstream failure as "Invalid query format" and hide which
 * version was rejected and why.
 *
 * What comes out of the parse is checked rather than trusted. The query is caller-controlled, and
 * `agentSettingsRevision` goes straight to TypeORM: a string or an object there surfaces as a
 * driver error instead of a clean rejection.
 */
function parseStreamPayload(query: string): StreamPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(query)
  } catch (_) {
    throw new ForbiddenException("Invalid query format")
  }

  const payload = isRecord(parsed) ? parsed.payload : undefined
  if (!isRecord(payload)) throw new ForbiddenException("Invalid query format")

  const { content, attachmentDocumentId, agentSettingsRevision } = payload
  if (typeof content !== "string") throw new ForbiddenException("Missing user content")
  if (!isOptionalString(attachmentDocumentId)) {
    throw new ForbiddenException("Invalid attachment document")
  }
  if (!isOptionalInteger(agentSettingsRevision)) {
    throw new ForbiddenException("Settings version must be an integer")
  }

  return { content, attachmentDocumentId, agentSettingsRevision }
}
