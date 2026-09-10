import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { PublicChatLegacyRoutes, PublicChatRoutes } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from "@nestjs/common"
import { Observable } from "rxjs"
import { toMcpAppHtmlDtos } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
import { EmbedTokenGuard } from "../guards/embed-token.guard"
import { PublicSessionTokenGuard } from "../guards/public-session-token.guard"
import type { PublicAgentSession } from "../public-agent-sessions/public-agent-session.entity"
import type { PublicChatRequest, PublicChatSessionRequest } from "../public-chat.request"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "../public-chat.service"
import {
  toCreatePublicSessionResponseDto,
  toEmbedPublicConfigDto,
  toPublicAgentSessionDto,
} from "./public-chat-v1.mappers"

/**
 * Public chat API v1, a versioned contract with external integrators
 * (`docs/public-api-contract.md`). Every route answers on two paths: the versioned
 * `/public/v1/agents/:embedToken/...` and the unprefixed `/public/agents/:embedToken/...`,
 * which predates versioning and is a plain alias of v1. Same bodies, same errors, only the
 * prefix differs, so one method serves both paths.
 *
 * Before adding a `v2/` folder, follow "Shipping a new major version" in
 * `docs/public-api-contract.md`: the DTOs and route definitions must be split per major in
 * `api-contracts` first, or the new mappers will silently change what v1 serves.
 */
@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatV1Controller {
  private readonly logger = new Logger(PublicChatV1Controller.name)

  constructor(private readonly publicChatService: PublicChatService) {}

  @Get([PublicChatRoutes.getConfig.path, PublicChatLegacyRoutes.getConfig.path])
  getConfig(@Req() request: PublicChatRequest): typeof PublicChatRoutes.getConfig.response {
    return { data: toEmbedPublicConfigDto(request.embedConfig) }
  }

  @Post([PublicChatRoutes.createSession.path, PublicChatLegacyRoutes.createSession.path])
  async createSession(
    @Req() request: PublicChatRequest,
    @Body() body: typeof PublicChatRoutes.createSession.request,
  ): Promise<typeof PublicChatRoutes.createSession.response> {
    const { session, sessionToken } = await this.publicChatService.createSession(
      request.embedConfig,
      body.payload?.externalVisitorId,
    )
    return { data: toCreatePublicSessionResponseDto(session, sessionToken) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get([PublicChatRoutes.getSession.path, PublicChatLegacyRoutes.getSession.path])
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getSession.response> {
    const { session, messages } = await this.publicChatService.getSession(request.publicSession)
    return { data: toPublicAgentSessionDto(session, messages) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get([PublicChatRoutes.getMcpAppHtml.path, PublicChatLegacyRoutes.getMcpAppHtml.path])
  async getMcpAppHtml(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getMcpAppHtml.response> {
    const htmlByKey = await this.publicChatService.getMcpAppHtml(request.publicSession)
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  /** `@Sse` takes a single path, so the alias gets its own method building the same stream. */
  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessages(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    return this.buildStream(request.publicSession, query)
  }

  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatLegacyRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessagesOnLegacyAlias(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    return this.buildStream(request.publicSession, query)
  }

  /**
   * Every failure reaches the client inside the stream. The response is already
   * `text/event-stream` when the payload is parsed, so a rejected payload, a missing agent
   * or a failed generation is one `{ type: "error" }` event, then the end of the stream:
   * never a JSON error, never a bare `event: error` frame. This is part of the public
   * contract. The generation layer emits its own error event before throwing, which is
   * not doubled here.
   */
  private buildStream(publicSession: PublicAgentSession, query: string): Observable<StreamEvent> {
    return new Observable<StreamEvent>((subscriber) => {
      let messageId = ""
      let lastEventType: StreamEventPayload["type"] | undefined
      const forward = (event: StreamEvent) => {
        const payload = JSON.parse(String(event.data)) as StreamEventPayload
        lastEventType = payload.type
        if (payload.type === "start") messageId = payload.messageId
        subscriber.next(event)
      }
      const fail = (error: unknown) => {
        if (lastEventType !== "error") {
          subscriber.next(
            toStreamEvent({ type: "error", messageId, error: this.publicErrorMessage(error) }),
          )
        }
        subscriber.complete()
      }

      let userContent: string
      try {
        userContent = parseStreamQuery(query)
      } catch (error) {
        fail(error)
        return
      }
      void (async () => {
        try {
          const events = this.publicChatService.streamResponse(publicSession, userContent, forward)
          for await (const event of events) forward(event)
          subscriber.complete()
        } catch (error) {
          fail(error)
        }
      })()
    })
  }

  /** Only messages meant for a caller leave the server; anything else is logged and made generic. */
  private publicErrorMessage(error: unknown): string {
    if (error instanceof HttpException) return error.message
    this.logger.error("Public chat stream failed", error instanceof Error ? error.stack : error)
    return "Internal server error"
  }
}

function toStreamEvent(payload: StreamEventPayload): StreamEvent {
  return { data: JSON.stringify(payload) } as StreamEvent
}

function parseStreamQuery(query: string): string {
  let parsedQuery: typeof PublicChatRoutes.streamMessages.request
  try {
    parsedQuery = JSON.parse(query) as typeof PublicChatRoutes.streamMessages.request
  } catch {
    throw new BadRequestException("Invalid query format")
  }
  const userContent = parsedQuery.payload?.content
  if (!userContent?.trim()) {
    throw new BadRequestException("User content must not be empty")
  }
  return userContent
}
