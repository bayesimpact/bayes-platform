/**
 * Public chat API contract: the DTOs served under `PUBLIC_PATH_PREFIX`.
 *
 * This file is self-contained on purpose. The public copies below restate the
 * shared shapes they mirror, and `PublicContractPins` fails `typecheck` when a
 * shared type drifts from its public copy. A failure here means a shared type
 * change altered the public contract: follow `docs/public-api-contract.md`
 * (maintainer go, version bump, documentation) before updating the copy.
 */
import type {
  AgentSessionMcpAppDto,
  AgentSessionMcpAppHtmlDto,
  AgentSessionToolCallDto,
  StreamEventPayload,
  ToolName,
} from "../agents/shared/agent-session-messages/agent-session-messages.dto"
import type { TimeType } from "../generic"
import type { Assert, Equals } from "../internal/type-equality"
import type { PUBLIC_API_MAJOR } from "./public-chat.version"

/** Returned by the public config route: branding only, no secrets. */
export type EmbedPublicConfigDto = {
  agentName: string
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
  bannerText: string | null
}

/**
 * Config served on the legacy alias (`/public/agents/...`). The alias predates the banner:
 * embed snippets deployed against it never received `bannerText`, so it is not added.
 */
export type LegacyEmbedPublicConfigDto = {
  agentName: string
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
}

/** Name of a tool the agent ran: a built-in tool or any MCP tool name. */
export type PublicToolName = ToolName | (string & {})

/** MCP App card pointer attached to a tool call. `html` is never present on session messages. */
export type PublicMcpAppDto = {
  mcpServerId: string
  resourceUri: string
  html?: string
}

export type PublicToolCallDto = {
  id: string
  name: PublicToolName
  arguments: Record<string, unknown>
  /** Raw MCP tool result (`content`, `structuredContent`, `_meta`) when an MCP App is rendered. */
  result?: unknown
  mcpApp?: PublicMcpAppDto
}

/** Current HTML of one MCP App card, served by the `mcp-app-html` route. */
export type PublicMcpAppHtmlDto = {
  mcpServerId: string
  resourceUri: string
  html: string
}

export type PublicSessionMessageDto = {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt: TimeType
  /**
   * Present when the turn ran tools. MCP Apps carry their `ui://` card pointer; the card HTML
   * is served by the `mcp-app-html` route.
   */
  toolCalls?: PublicToolCallDto[]
}

export type PublicAgentSessionDto = {
  id: string
  agentId: string
  messages: PublicSessionMessageDto[]
  createdAt: TimeType
}

export type CreatePublicSessionRequestDto = {
  externalVisitorId?: string
}

export type CreatePublicSessionResponseDto = {
  sessionId: string
  sessionToken: string
}

/** Payload of the stream route, sent URL-encoded in the `q` query parameter. */
export type PublicChatStreamRequestDto = {
  content: string
}

/** One server-sent event of the stream route, JSON-encoded in a `data:` line. */
export type PublicStreamEventPayload =
  | { type: "start"; messageId: string }
  | { type: "chunk"; content: string; messageId: string }
  | { type: "notify_client"; toolName: PublicToolName }
  | { type: "end"; messageId: string; fullContent: string }
  | { type: "error"; messageId: string; error: string }

/**
 * Pins the public copies to the shared types they mirror. Do not edit a pin to make
 * it compile: apply `docs/public-api-contract.md` instead.
 */
export type PublicContractPins = [
  Assert<Equals<PublicMcpAppDto, AgentSessionMcpAppDto>>,
  Assert<Equals<PublicToolCallDto, AgentSessionToolCallDto>>,
  Assert<Equals<PublicMcpAppHtmlDto, AgentSessionMcpAppHtmlDto>>,
  Assert<Equals<PublicStreamEventPayload, StreamEventPayload>>,
  Assert<Equals<typeof PUBLIC_API_MAJOR, "v1">>,
]
