import type { StreamEvent } from "@caseai-connect/api-contracts"
import { PublicChatLegacyRoutes, PublicChatRoutes } from "@caseai-connect/api-contracts"
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
import { toEmbedPublicConfigDto } from "./public-chat.mappers"
import type { PublicChatRequest, PublicChatSessionRequest } from "./public-chat.request"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "./public-chat.service"

/**
 * Public chat API, a versioned contract with external integrators
 * (`docs/public-api-contract.md`). Every route answers on its `/public/v1/...`
 * path and on the unprefixed legacy alias, kept for as long as v1 is served.
 */
@UseGuards(EmbedTokenGuard)
@Controller()
export class PublicChatController {
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
    const session = await this.publicChatService.createSession(
      request.embedConfig,
      body.payload?.externalVisitorId,
    )
    return { data: session }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get([PublicChatRoutes.getSession.path, PublicChatLegacyRoutes.getSession.path])
  async getSession(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getSession.response> {
    const sessionDto = await this.publicChatService.getSession(request.publicSession)
    return { data: sessionDto }
  }

  @UseGuards(PublicSessionTokenGuard)
  @Get([PublicChatRoutes.getMcpAppHtml.path, PublicChatLegacyRoutes.getMcpAppHtml.path])
  async getMcpAppHtml(
    @Req() request: PublicChatSessionRequest,
  ): Promise<typeof PublicChatRoutes.getMcpAppHtml.response> {
    return { data: await this.publicChatService.getMcpAppHtml(request.publicSession) }
  }

  // `@Sse` takes a single path, so the legacy alias gets its own thin handler.
  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessages(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    return this.buildStream(request, query)
  }

  @UseGuards(PublicSessionTokenGuard)
  @Sse(PublicChatLegacyRoutes.streamMessages.path, { method: 0 /* GET */ })
  streamMessagesLegacy(
    @Req() request: PublicChatSessionRequest,
    @Query("q") query: string,
  ): Observable<MessageEvent> {
    return this.buildStream(request, query)
  }

  /**
   * Validation runs inside the stream: the response is already an SSE stream, so a
   * rejected payload reaches the client as an `event: error` frame on a 200
   * response, never as a JSON error. This is part of the public contract.
   */
  private buildStream(request: PublicChatSessionRequest, query: string): Observable<MessageEvent> {
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
