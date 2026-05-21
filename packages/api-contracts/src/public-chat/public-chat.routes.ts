import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreatePublicSessionRequestDto,
  CreatePublicSessionResponseDto,
  PublicAgentSessionDto,
} from "./public-chat.dto"

// SSE streaming responses do not follow the usual ResponseData<T> shape.
export type PublicChatStreamResponse = unknown

const agentBasePath = "public/agents/:embedToken"
const sessionBasePath = `${agentBasePath}/sessions/:sessionId`

export const PublicChatRoutes = {
  createSession: defineRoute<
    ResponseData<CreatePublicSessionResponseDto>,
    RequestPayload<CreatePublicSessionRequestDto>
  >({
    method: "post",
    path: `${agentBasePath}/sessions`,
  }),

  getSession: defineRoute<ResponseData<PublicAgentSessionDto>>({
    method: "get",
    path: sessionBasePath,
  }),

  streamMessages: defineRoute<
    ResponseData<PublicChatStreamResponse>,
    RequestPayload<{ content: string }>
  >({
    method: "post",
    path: `${sessionBasePath}/messages/stream`,
  }),
}
