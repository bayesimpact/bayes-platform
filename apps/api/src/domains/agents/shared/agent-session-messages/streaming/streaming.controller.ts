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
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { StreamingLlmService } from "./streaming-llm.service"
import type { AgentSessionScope } from "./streaming-session.types"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project", "agent", "agentSession")
@Controller()
export class StreamingController {
  constructor(
    private readonly chatStreamingLLMService: StreamingLlmService,
    private readonly agentSettingsService: AgentSettingsService,
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
          const agentSettings = await this.resolveAgentSettings({
            connectScope,
            agentId: agent.id,
            sessionType: session.type,
            revision: agentSettingsRevision,
          })
          const agentSessionScope: AgentSessionScope = {
            connectScope,
            agent,
            agentSettings,
            session,
          }
          const events = this.chatStreamingLLMService.streamAgentResponse({
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
