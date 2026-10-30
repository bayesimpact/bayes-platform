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
} from "./public-chat-v1.dto"
import { PUBLIC_API_V1_MAJOR } from "./public-chat-v1.version"

const agentBasePath = `${PUBLIC_PATH_PREFIX}/${PUBLIC_API_V1_MAJOR}/agents/:embedToken`
const sessionBasePath = `${agentBasePath}/sessions/:sessionId`

/**
 * Public chat API v1: `/public/v1/agents/:embedToken/...`, a versioned contract with
 * external integrators (`docs/public-api-contract.md`). Deprecated since v2 and served
 * until the stop date published on the help site. Frozen: new work goes to v2.
 */
export const PublicChatV1Routes = {
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
   * Server-sent events. The request payload travels URL-encoded in the `q` query
   * parameter (`?q=<encodeURIComponent(JSON.stringify({ payload: { content } }))>`) so
   * the route stays reachable with GET. Each `data:` line of the response is one
   * JSON-encoded `PublicStreamEventPayload`; the `ResponseData` wrapper does not apply.
   * Failures reach the client as a `{ type: "error" }` event on a 200 response.
   */
  streamMessages: defineRoute<
    ResponseData<PublicStreamEventPayload>,
    RequestPayload<PublicChatStreamRequestDto>
  >({
    method: "get",
    path: `${sessionBasePath}/messages/stream`,
  }),
}
