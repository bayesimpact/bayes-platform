import { AgentSessionMessagesRoutes, type StreamEvent } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  Controller,
  ForbiddenException,
  NotFoundException,
  Query,
  Req,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import { Observable } from "rxjs"
import type { EndpointRequestWithAgentSession } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import type { Agent } from "@/domains/agents/agent.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "@/domains/agents/agents.service"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationAgentSessionsService } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.service"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingService } from "./streaming.service"
import type { AgentSessionScope } from "./streaming-session.types"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class StreamingController {
  constructor(
    private readonly chatStreamingService: StreamingService,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly agentsService: AgentsService,
    private readonly conversationAgentSessionsService: ConversationAgentSessionsService,
  ) {}

  @CheckPolicy((policy) => policy.canList())
  @Sse(AgentSessionMessagesRoutes.stream.path, { method: 0 /* GET */ })
  stream(
    @Req() request: EndpointRequestWithAgentSession<ConversationAgentSession>,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
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
          // PATCH_CONTINUATION_CONTENT_V1_APPLIED
          const runTurn = async (scope: AgentSessionScope, content: string, includeAttachment: boolean) => {
            const events = this.chatStreamingService.streamAgentResponse({
              agentSessionScope: scope,
              userContent: content,
              attachmentDocumentId: includeAttachment ? attachmentDocumentId : undefined,
              notifyClient: (event) => {
                subscriber.next(event)
              },
            })
            for await (const event of events) {
              subscriber.next(event)
            }
          }

          // Trigger content for a turn auto-continued BACK to the root after a handoff child
          // concluded: the root isn't being asked anything new, so the child's last answer (e.g.
          // "non") must never be replayed as if it were addressed to the root - it would read
          // that literal content as a fresh answer to interpret (see the confused response this
          // caused before this constant existed) instead of resuming from the handoff-completion
          // epilogue like it should. The orchestrator's own prompt already treats a short, vague
          // message this way (see its FAILURE RULE), matching exactly what a user manually typing
          // "ok" here has always produced - this only automates that same, already-correct path.
          const ROOT_CONTINUATION_TRIGGER = "ok"

          let nextActive = await this.resolveActiveAgentScope({ connectScope, agent, session })
          let turnContent = userContent

          // Auto-continue: after any turn hands control to a DIFFERENT agent than the one that
          // just spoke - the root activating a brand-new handoff child, or a concluding child
          // handing control back to the root (activeAgentId cleared or advanced) - immediately
          // run that next agent's own turn too, in the same response, instead of leaving the
          // user to send a throwaway message before seeing it speak. Each iteration re-derives
          // the decision from the session's own activeAgentId, set entirely by the agents' own
          // tool calls (a handoff, or concludeHandoff) - the platform never chooses what happens
          // next, it only removes the wasted round-trip once an agent already decided. Hard-
          // capped so a misconfigured chain (e.g. two agents handing off to each other) can
          // never turn into a runaway loop within one response.
          const MAX_AUTO_CONTINUES = 4
          for (let step = 0; step < MAX_AUTO_CONTINUES; step++) {
            const agentSettings = await this.resolveAgentSettings({
              connectScope,
              agentId: nextActive.agent.id,
              sessionType: session.type,
              // A handoff child always runs its own latest settings — the explicit revision
              // picker is a playground affordance for the root agent under test, not for
              // whichever agent currently happens to be in control of the conversation.
              revision: nextActive.agent.id === agent.id ? agentSettingsRevision : undefined,
            })
            const ranAgentId = nextActive.agent.id
            await runTurn(
              {
                connectScope,
                agent: nextActive.agent,
                agentSettings,
                session: nextActive.session,
              },
              turnContent,
              step === 0,
            )

            const refreshedSession = await this.conversationAgentSessionsService.findById({
              id: session.id,
              connectScope,
            })
            if (!refreshedSession) break

            const candidate = await this.resolveActiveAgentScope({
              connectScope,
              agent,
              session: refreshedSession,
            })
            if (candidate.agent.id === ranAgentId) break

            // Handing off into a freshly-activated child: reuse the real content that drove the
            // decision (the child's own prompt treats it as a generic opener, e.g. "bonjour").
            // Returning to the root after a child concluded: use the neutral trigger above instead.
            turnContent = candidate.agent.id === agent.id ? ROOT_CONTINUATION_TRIGGER : userContent
            nextActive = candidate
          }

          subscriber.complete()
        } catch (error) {
          subscriber.error(error)
        }
      })()
    })
  }

  /**
   * When the session's `activeAgentId` points at a handoff sub-agent, resolves that agent's
   * own real session instead of the root — the parent agent is not consulted for this turn,
   * the child talks to the user directly. Falls back to the root agent/session in every other
   * case (no active agent, or the active agent no longer exists).
   */
  private async resolveActiveAgentScope({
    connectScope,
    agent,
    session,
  }: {
    connectScope: RequiredConnectScope
    agent: Agent
    session: ConversationAgentSession
  }): Promise<{ agent: Agent; session: ConversationAgentSession }> {
    if (!session.activeAgentId) {
      return { agent, session }
    }

    const activeAgent = await this.agentsService.findAgentById({
      connectScope,
      agentId: session.activeAgentId,
    })
    if (!activeAgent) {
      return { agent, session }
    }

    const activeSession = await this.conversationAgentSessionsService.findOrCreateSubSession({
      connectScope,
      agentId: activeAgent.id,
      userId: session.userId,
      parentSessionId: session.id,
      type: session.type,
    })

    return { agent: activeAgent, session: activeSession }
  }

  /**
   * Settings the answer runs with.
   *
   * A playground session with no explicit revision runs the draft when there is one. The Studio
   * playground renders before its settings history has loaded, so the client cannot always name
   * a revision, and defaulting that window to the published one would run a version the header
   * does not claim. A live session keeps running the newest published revision; it can never
   * reach here with a revision, that is rejected in the handler.
   */
  private async resolveAgentSettings({
    connectScope,
    agentId,
    sessionType,
    revision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    sessionType: ConversationAgentSession["type"]
    revision: number | undefined
  }): Promise<AgentSettings> {
    if (revision === undefined) {
      return sessionType === "playground"
        ? this.agentSettingsService.getLast({ connectScope, agentId, includesDraft: true })
        : this.agentSettingsService.getLast({ connectScope, agentId })
    }

    const agentSettings = await this.agentSettingsService.get({ connectScope, agentId, revision })
    if (!agentSettings) {
      throw new NotFoundException(`Version ${revision} not found for agent ${agentId}`)
    }
    if (agentSettings.isArchived) {
      throw new UnprocessableEntityException(`Version ${revision} is archived and cannot be run`)
    }
    return agentSettings
  }
}

type StreamPayload = (typeof AgentSessionMessagesRoutes.stream.request)["payload"]

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
