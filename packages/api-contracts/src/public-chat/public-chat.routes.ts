import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreatePublicSessionRequestDto,
  CreatePublicSessionResponseDto,
  EmbedPublicConfigDto,
  PublicAgentSessionDto,
  PublicChatStreamRequestDto,
  PublicMcpAppHtmlDto,
  PublicStreamEventPayload,
} from "./public-chat.dto"
import { PUBLIC_API_MAJOR } from "./public-chat.version"

/**
 * Namespace for endpoints callable from arbitrary host pages (embed widget).
 * The API selects its open CORS policy on this prefix (ADR 0015), and their
 * security is enforced by EmbedTokenGuard, not by CORS. Renaming it breaks
 * deployed embed snippets.
 */
export const PUBLIC_PATH_PREFIX = "public"

const v1AgentBasePath = `${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`
const v1SessionBasePath = `${v1AgentBasePath}/sessions/:sessionId`

/**
 * The public chat API is a versioned contract with external integrators:
 * `docs/public-api-contract.md`. Routes live under `/public/v1/agents/:embedToken/...`.
 */
export const PublicChatRoutes = {
  getConfig: defineRoute<ResponseData<EmbedPublicConfigDto>>({
    method: "get",
    path: `${v1AgentBasePath}/config`,
  }),

  createSession: defineRoute<
    ResponseData<CreatePublicSessionResponseDto>,
    RequestPayload<CreatePublicSessionRequestDto>
  >({
    method: "post",
    path: `${v1AgentBasePath}/sessions`,
  }),

  getSession: defineRoute<ResponseData<PublicAgentSessionDto>>({
    method: "get",
    path: v1SessionBasePath,
  }),

  /**
   * Current HTML of every MCP App card the session's replies point at. Separate from
   * `getSession` because reading it connects to each MCP server, which must not delay the
   * transcript; the widget loads it once the messages are on screen.
   */
  getMcpAppHtml: defineRoute<ResponseData<PublicMcpAppHtmlDto[]>>({
    method: "get",
    path: `${v1SessionBasePath}/mcp-app-html`,
  }),

  /**
   * Server-sent events. The payload travels in the JSON body, never in the URL: a long
   * message cannot exceed a proxy's URL limit, and access logs never hold its text. Each
   * `data:` line of the response is one JSON-encoded `PublicStreamEventPayload`; the
   * `ResponseData` wrapper does not apply. Failures reach the client as a
   * `{ type: "error" }` event on a 200 response. The path is not under `messages/` so that
   * no `POST .../messages/:messageId` route can ever catch it. Replaced the GET
   * `messages/stream?q=` route of v1 in 1.3.
   */
  streamReply: defineRoute<
    ResponseData<PublicStreamEventPayload>,
    RequestPayload<PublicChatStreamRequestDto>
  >({
    method: "post",
    path: `${v1SessionBasePath}/stream`,
  }),
}
