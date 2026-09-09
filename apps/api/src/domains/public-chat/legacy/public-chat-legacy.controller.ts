import type { StreamEvent } from "@caseai-connect/api-contracts"
import { PublicChatLegacyRoutes } from "@caseai-connect/api-contracts"
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
} from "./public-chat-legacy.mappers"

/**
 * Legacy alias of the public chat API at the unprefixed paths
 * `/public/agents/:embedToken/...`, for embed snippets deployed before versioning. Served for
 * as long as v1 is served. It answers as it did before versioning: no MCP App HTML route and
 * no `bannerText` in the config, both of which arrived with v1.
 */
@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatLegacyController extends PublicChatController {
  @Get(PublicChatLegacyRoutes.getConfig.path)
  getConfig(@Req() request: PublicChatRequest): typeof PublicChatLegacyRoutes.getConfig.response {
    return { data: toEmbedPublicConfigDto(request.embedConfig) }
  }

  @Post(PublicChatLegacyRoutes.createSession.path)
  async createSession(
    @Req() request: PublicChatRequest,
    @Body() body: typeof PublicChatLegacyRoutes.createSession.request,
  ): Promise<typeof PublicChatLegacyRoutes.createSession.response> {
    const { session, sessionToken } = await this.publicChatService.createSession(
      request.embedConfig,
      body.payload?.externalVisitorId,
    )
    return { data: toCreatePublicSessionResponseDto(session, sessionToken) }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get(PublicChatLegacyRoutes.getSession.path)
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatLegacyRoutes.getSession.response> {
    const { session, messages } = await this.publicChatService.getSession(request.publicSession)
    return { data: toPublicAgentSessionDto(session, messages) }
  }

  /**
   * Validation runs inside the stream: the response is already an SSE stream, so a
   * rejected payload reaches the client as an `event: error` frame on a 200
   * response, never as a JSON error. This is part of the public contract.
   */
  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatLegacyRoutes.streamMessages.path, { method: 0 /* GET */ })
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
  let parsedQuery: typeof PublicChatLegacyRoutes.streamMessages.request
  try {
    parsedQuery = JSON.parse(query) as typeof PublicChatLegacyRoutes.streamMessages.request
  } catch {
    throw new ForbiddenException("Invalid query format")
  }
  const userContent = parsedQuery.payload?.content
  if (!userContent?.trim()) {
    throw new ForbiddenException("User content must not be empty")
  }
  return userContent
}
