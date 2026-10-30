import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreatePublicSessionRequestDto,
  CreatePublicSessionResponseDto,
  EmbedPublicConfigDto,
  LegacyEmbedPublicConfigDto,
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

/**
 * The public chat API is a versioned contract with external integrators:
 * `docs/public-api-contract.md`. Routes live under `/public/v1/...`. The
 * unprefixed paths (`/public/agents/...`) predate versioning and stay served
 * (`PublicChatLegacyRoutes`) until the last integrator moves to v1. They carry the
 * routes below with their pre-versioning config shape, plus their GET stream; v1
 * additions do not reach them.
 */
function buildPublicChatRoutes<ConfigDto>(agentBasePath: string) {
  const sessionBasePath = `${agentBasePath}/sessions/:sessionId`
  return {
    getConfig: defineRoute<ResponseData<ConfigDto>>({
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
  }
}

const v1AgentBasePath = `${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`

/** Versioned public routes: `/public/v1/agents/:embedToken/...`. New integrations use these. */
export const PublicChatRoutes = {
  ...buildPublicChatRoutes<EmbedPublicConfigDto>(v1AgentBasePath),

  /**
   * Current HTML of every MCP App card the session's replies point at. Separate from
   * `getSession` because reading it connects to each MCP server, which must not delay the
   * transcript; the widget loads it once the messages are on screen. Added with v1, so the
   * unprefixed paths do not carry it.
   */
  getMcpAppHtml: defineRoute<ResponseData<PublicMcpAppHtmlDto[]>>({
    method: "get",
    path: `${v1AgentBasePath}/sessions/:sessionId/mcp-app-html`,
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
    path: `${v1AgentBasePath}/sessions/:sessionId/stream`,
  }),
}

const legacyAgentBasePath = `${PUBLIC_PATH_PREFIX}/agents/:embedToken`

/**
 * Unprefixed paths that predate versioning: `/public/agents/:embedToken/...`. Frozen on the
 * shape they served then, so no MCP App HTML route and no `bannerText` in the config, and a
 * stream failure stays a bare `event: error` frame. Deleted once the last integrator moves.
 */
export const PublicChatLegacyRoutes = {
  ...buildPublicChatRoutes<LegacyEmbedPublicConfigDto>(legacyAgentBasePath),

  /**
   * Server-sent events. The request payload travels URL-encoded in the `q` query
   * parameter (`?q=<encodeURIComponent(JSON.stringify({ payload: { content } }))>`) so
   * the route stays reachable with GET. Each `data:` line of the response is one
   * JSON-encoded `PublicStreamEventPayload`; the `ResponseData` wrapper does not apply.
   * v1 removed this route in 1.3 for `streamReply`; only the unprefixed paths keep it.
   */
  streamMessages: defineRoute<
    ResponseData<PublicStreamEventPayload>,
    RequestPayload<PublicChatStreamRequestDto>
  >({
    method: "get",
    path: `${legacyAgentBasePath}/sessions/:sessionId/messages/stream`,
  }),
}
