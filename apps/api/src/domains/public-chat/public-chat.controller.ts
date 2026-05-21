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
import { EmbedTokenGuard } from "./guards/embed-token.guard"
import { PublicSessionTokenGuard } from "./guards/public-session-token.guard"
import type { PublicChatRequest, PublicChatSessionRequest } from "./public-chat.request"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "./public-chat.service"

@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatController {
  constructor(private readonly publicChatService: PublicChatService) {}

  @Post(PublicChatRoutes.createSession.path)
  async createSession(
    @Req() request: PublicChatRequest,
    @Body() body: typeof PublicChatRoutes.createSession.request,
  ): Promise<typeof PublicChatRoutes.createSession.response> {
    const { sessionId, sessionToken } = await this.publicChatService.createSession(
      request.agent,
      body.payload?.externalVisitorId,
    )
    return { data: { sessionId, sessionToken } }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get(PublicChatRoutes.getSession.path)
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getSession.response> {
    const sessionDto = await this.publicChatService.getSession(request.publicSession)
    return { data: sessionDto }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessages(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
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

    const { publicSession, agent } = request

    return new Observable<StreamEvent>((subscriber) => {
      void (async () => {
        try {
          const events = this.publicChatService.streamResponse(
            publicSession,
            agent,
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
