import type { RequestPayload, ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import { PUBLIC_PATH_PREFIX } from "../public-chat.prefix"
import type {
  CreatePublicSessionRequestDto,
  CreatePublicSessionResponseDto,
  EmbedPublicConfigDto,
  PublicAgentSessionDto,
  PublicChatStreamRequestDto,
  PublicMcpAppHtmlDto,
  PublicStreamEventPayload,
} from "./public-chat-v2.dto"
import { PUBLIC_API_V2_MAJOR } from "./public-chat-v2.version"

const agentBasePath = `${PUBLIC_PATH_PREFIX}/${PUBLIC_API_V2_MAJOR}/agents/:embedToken`
const sessionBasePath = `${agentBasePath}/sessions/:sessionId`

/**
 * Public chat API v2: `/public/v2/agents/:embedToken/...`, a versioned contract with
 * external integrators (`docs/public-api-contract.md`). New integrations use these paths.
 */
export const PublicChatV2Routes = {
  getConfig: defineRoute<ResponseData<EmbedPublicConfigDto>>({
    method: "get",
    path: `${agentBasePath}/config`,
  }),

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

  /**
   * Current HTML of every MCP App card the session's replies point at. Separate from
   * `getSession` because reading it connects to each MCP server, which must not delay the
   * transcript; the widget loads it once the messages are on screen.
   */
  getMcpAppHtml: defineRoute<ResponseData<PublicMcpAppHtmlDto[]>>({
    method: "get",
    path: `${sessionBasePath}/mcp-app-html`,
  }),

  /**
   * Server-sent events. The payload travels in the JSON body, never in the URL: a long
   * message cannot exceed a proxy's URL limit, and access logs never hold its text. Each
   * `data:` line of the response is one JSON-encoded `PublicStreamEventPayload`; the
   * `ResponseData` wrapper does not apply. Failures reach the client as a
   * `{ type: "error" }` event on a 200 response. The path is not under `messages/` so that
   * no `POST .../messages/:messageId` route can ever catch it.
   */
  streamReply: defineRoute<
    ResponseData<PublicStreamEventPayload>,
    RequestPayload<PublicChatStreamRequestDto>
  >({
    method: "post",
    path: `${sessionBasePath}/stream`,
  }),
}
