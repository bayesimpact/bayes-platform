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

/**
 * The public chat API is a versioned contract with external integrators:
 * `docs/public-api-contract.md`. Routes live under `/public/v1/...`. The
 * unprefixed paths (`/public/agents/...`) predate versioning and stay served as
 * a legacy alias of v1 for as long as v1 is served (`PublicChatLegacyRoutes`).
 */
function buildPublicChatRoutes(agentBasePath: string) {
  const sessionBasePath = `${agentBasePath}/sessions/:sessionId`
  return {
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
     */
    streamMessages: defineRoute<
      ResponseData<PublicStreamEventPayload>,
      RequestPayload<PublicChatStreamRequestDto>
    >({
      method: "get",
      path: `${sessionBasePath}/messages/stream`,
    }),
  }
}

/** Versioned public routes: `/public/v1/agents/:embedToken/...`. New integrations use these. */
export const PublicChatRoutes = buildPublicChatRoutes(
  `${PUBLIC_PATH_PREFIX}/${PUBLIC_API_MAJOR}/agents/:embedToken`,
)

/** Legacy alias of v1 at the unprefixed paths: `/public/agents/:embedToken/...`. */
export const PublicChatLegacyRoutes = buildPublicChatRoutes(
  `${PUBLIC_PATH_PREFIX}/agents/:embedToken`,
)
