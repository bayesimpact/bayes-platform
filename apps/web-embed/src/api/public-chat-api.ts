import type {
  CreatePublicSessionResponseDto,
  EmbedPublicConfigDto,
  PublicAgentSessionDto,
  PublicMcpAppHtmlDto,
  PublicStreamEventPayload,
} from "@caseai-connect/api-contracts"
import { PublicChatRoutes } from "@caseai-connect/api-contracts"
import { apiUrl as routeUrl } from "./api-base"

/** Reference client of the public chat API v1 (`docs/public-api-contract.md`). */

// ─── Public embed config ───────────────────────────────────────────────────

export async function getEmbedConfig(embedToken: string): Promise<EmbedPublicConfigDto> {
  const response = await fetch(routeUrl(PublicChatRoutes.getConfig.getPath({ embedToken })))
  if (!response.ok) throw new ApiError(response.status, "Failed to load embed config")
  const json = (await response.json()) as { data: EmbedPublicConfigDto }
  return json.data
}

// ─── Session management ────────────────────────────────────────────────────

export async function createSession(
  embedToken: string,
  externalVisitorId?: string,
  /** Values of the {{variables}} the agent's instructions declare (API 1.1). */
  variables?: Record<string, string>,
): Promise<CreatePublicSessionResponseDto> {
  const response = await fetch(routeUrl(PublicChatRoutes.createSession.getPath({ embedToken })), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: { externalVisitorId, variables } }),
  })
  if (!response.ok) throw new ApiError(response.status, "Failed to create session")
  const json = (await response.json()) as { data: CreatePublicSessionResponseDto }
  return json.data
}

export async function getSession(
  embedToken: string,
  sessionId: string,
  sessionToken: string,
): Promise<PublicAgentSessionDto> {
  const response = await fetch(
    routeUrl(PublicChatRoutes.getSession.getPath({ embedToken, sessionId })),
    { headers: { "X-Session-Token": sessionToken } },
  )
  if (!response.ok) throw new ApiError(response.status, "Failed to load session")
  const json = (await response.json()) as { data: PublicAgentSessionDto }
  return json.data
}

/**
 * Current HTML of the MCP App cards the session points at. Separate from `getSession` because
 * the server has to contact each MCP server, which must not delay the transcript.
 */
export async function getMcpAppHtml(
  embedToken: string,
  sessionId: string,
  sessionToken: string,
): Promise<PublicMcpAppHtmlDto[]> {
  const response = await fetch(
    routeUrl(PublicChatRoutes.getMcpAppHtml.getPath({ embedToken, sessionId })),
    { headers: { "X-Session-Token": sessionToken } },
  )
  if (!response.ok) throw new ApiError(response.status, "Failed to load MCP App cards")
  const json = (await response.json()) as { data: PublicMcpAppHtmlDto[] }
  return json.data
}

// ─── SSE streaming ─────────────────────────────────────────────────────────

/**
 * Streams assistant response chunks via SSE (fetch + ReadableStream).
 * We use fetch instead of EventSource because EventSource does not support
 * custom request headers and we need X-Session-Token.
 *
 * Yields parsed PublicStreamEventPayload objects as they arrive.
 */
export async function* streamReply(
  embedToken: string,
  sessionId: string,
  sessionToken: string,
  content: string,
): AsyncGenerator<PublicStreamEventPayload, void, unknown> {
  // The message travels in the body (API 1.3): never in the URL, where proxies cap its length
  // and access logs keep its text.
  const body: typeof PublicChatRoutes.streamReply.request = { payload: { content } }
  const response = await fetch(
    routeUrl(PublicChatRoutes.streamReply.getPath({ embedToken, sessionId })),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": sessionToken,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok || !response.body) throw new ApiError(response.status, "Failed to start stream")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE chunks are delimited by double newlines.
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue
        const raw = line.slice("data: ".length).trim()
        if (!raw || raw === "[DONE]") continue
        try {
          yield JSON.parse(raw) as PublicStreamEventPayload
        } catch {
          // Ignore malformed lines
        }
      }
    }
  }
}

// ─── Error type ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403
  }

  /** The retention purge emptied the session (API 2.0): start a new one. */
  get isSessionExpired() {
    return this.status === 410
  }
}
