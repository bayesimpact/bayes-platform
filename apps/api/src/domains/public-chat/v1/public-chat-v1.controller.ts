import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { PublicChatV1Routes } from "@caseai-connect/api-contracts"
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
import { PublicChatController } from "../public-chat.controller"
import type { PublicChatRequest, PublicChatSessionRequest } from "../public-chat.request"
import {
  toCreatePublicSessionResponseDto,
  toEmbedPublicConfigDto,
  toPublicAgentSessionDto,
} from "./public-chat-v1.mappers"

/**
 * Public chat API v1 at `/public/v1/agents/:embedToken/...`, a versioned contract with
 * external integrators (`docs/public-api-contract.md`). Deprecated since v2 and served until
 * the stop date published on the help site. Frozen: new work goes to `v2/`, which shares
 * nothing with this folder but the injected service.
 */
@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatV1Controller extends PublicChatController {
  private readonly logger = new Logger(PublicChatV1Controller.name)

  @Get(PublicChatV1Routes.getConfig.path)
  getConfig(@Req() request: PublicChatRequest): typeof PublicChatV1Routes.getConfig.response {
    return { data: toEmbedPublicConfigDto(request.embedConfig) }
  }

  @Post(PublicChatV1Routes.createSession.path)
  async createSession(
    @Req() request: PublicChatRequest,
    @Body() body: typeof PublicChatV1Routes.createSession.request,
  ): Promise<typeof PublicChatV1Routes.createSession.response> {
    const { session, sessionToken } = await this.publicChatService.createSession(
      request.embedConfig,
      body.payload?.externalVisitorId,
      body.payload?.variables,
    )
    return { data: toCreatePublicSessionResponseDto(session, sessionToken) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get(PublicChatV1Routes.getSession.path)
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatV1Routes.getSession.response> {
    const { session, messages } = await this.publicChatService.getSession(request.publicSession)
    return { data: toPublicAgentSessionDto(session, messages) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get(PublicChatV1Routes.getMcpAppHtml.path)
  async getMcpAppHtml(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatV1Routes.getMcpAppHtml.response> {
    const htmlByKey = await this.publicChatService.getMcpAppHtml(request.publicSession)
    return { data: toMcpAppHtmlDtos(htmlByKey) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatV1Routes.streamMessages.path, { method: 0 /* GET */ })
  streamMessages(
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
  let parsedQuery: typeof PublicChatV1Routes.streamMessages.request
  try {
    parsedQuery = JSON.parse(query) as typeof PublicChatV1Routes.streamMessages.request
  } catch {
    throw new BadRequestException("Invalid query format")
  }
  const userContent = parsedQuery.payload?.content
  if (!userContent?.trim()) {
    throw new BadRequestException("User content must not be empty")
  }
  return userContent
}
