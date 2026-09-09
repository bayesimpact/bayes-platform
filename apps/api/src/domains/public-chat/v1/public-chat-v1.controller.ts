import type { StreamEvent } from "@caseai-connect/api-contracts"
import { PublicChatRoutes } from "@caseai-connect/api-contracts"
import type { MessageEvent } from "@nestjs/common"
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from "@nestjs/common"
import { Observable } from "rxjs"
import { EmbedTokenGuard } from "../guards/embed-token.guard"
import { PublicSessionTokenGuard } from "../guards/public-session-token.guard"
import { PublicChatController } from "../public-chat.controller"
import type { PublicChatRequest, PublicChatSessionRequest } from "../public-chat.request"
import {
  toCreatePublicSessionResponseDto,
  toEmbedPublicConfigDto,
  toPublicAgentSessionDto,
  toPublicMcpAppHtmlDtos,
} from "./public-chat-v1.mappers"

/** Public chat API v1: `/public/v1/agents/:embedToken/...`. New integrations use these paths. */
@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatV1Controller extends PublicChatController {
  @Get(PublicChatRoutes.getConfig.path)
  getConfig(@Req() request: PublicChatRequest): typeof PublicChatRoutes.getConfig.response {
    return { data: toEmbedPublicConfigDto(request.embedConfig) }
  }

  @Post(PublicChatRoutes.createSession.path)
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
  @Get(PublicChatRoutes.getSession.path)
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getSession.response> {
    const { session, messages } = await this.publicChatService.getSession(request.publicSession)
    return { data: toPublicAgentSessionDto(session, messages) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get(PublicChatRoutes.getMcpAppHtml.path)
  async getMcpAppHtml(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getMcpAppHtml.response> {
    const htmlByKey = await this.publicChatService.getMcpAppHtml(request.publicSession)
    return { data: toPublicMcpAppHtmlDtos(htmlByKey) }
  }

  /**
   * Validation runs inside the stream: the response is already an SSE stream, so a
   * rejected payload reaches the client as an `event: error` frame on a 200
   * response, never as a JSON error. This is part of the public contract.
   */
  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessages(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    const { publicSession } = request
    return new Observable<StreamEvent>((subscriber) => {
      let userContent: string
      try {
        userContent = parseStreamQuery(query)
      } catch (error) {
        subscriber.error(error)
        return
      }
      void (async () => {
        try {
          const events = this.publicChatService.streamResponse(
            publicSession,
            userContent,
            (event) => subscriber.next(event),
          )
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

function parseStreamQuery(query: string): string {
  let parsedQuery: typeof PublicChatRoutes.streamMessages.request
  try {
    parsedQuery = JSON.parse(query) as typeof PublicChatRoutes.streamMessages.request
  } catch {
    throw new ForbiddenException("Invalid query format")
  }
  const userContent = parsedQuery.payload?.content
  if (!userContent?.trim()) {
    throw new ForbiddenException("User content must not be empty")
  }
  return userContent
}
