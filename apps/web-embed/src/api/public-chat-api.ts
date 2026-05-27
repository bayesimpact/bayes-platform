import type {
  EmbedPublicConfigDto,
  PublicAgentSessionDto,
  StreamEventPayload,
} from "@caseai-connect/api-contracts"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000"

// ─── Public embed config ───────────────────────────────────────────────────

export async function getEmbedConfig(embedToken: string): Promise<EmbedPublicConfigDto> {
  const response = await fetch(`${API_BASE}/public/agents/${embedToken}/config`)
  if (!response.ok) throw new ApiError(response.status, "Failed to load embed config")
  const json = (await response.json()) as { data: EmbedPublicConfigDto }
  return json.data
}

// ─── Session management ────────────────────────────────────────────────────

export async function createSession(
  embedToken: string,
  externalVisitorId?: string,
): Promise<{ sessionId: string; sessionToken: string }> {
  const response = await fetch(`${API_BASE}/public/agents/${embedToken}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: { externalVisitorId } }),
  })
  if (!response.ok) throw new ApiError(response.status, "Failed to create session")
  const json = (await response.json()) as { data: { sessionId: string; sessionToken: string } }
  return json.data
}

export async function getSession(
  embedToken: string,
  sessionId: string,
  sessionToken: string,
): Promise<PublicAgentSessionDto> {
  const response = await fetch(`${API_BASE}/public/agents/${embedToken}/sessions/${sessionId}`, {
    headers: { "X-Session-Token": sessionToken },
  })
  if (!response.ok) throw new ApiError(response.status, "Failed to load session")
  const json = (await response.json()) as { data: PublicAgentSessionDto }
  return json.data
}

// ─── SSE streaming ─────────────────────────────────────────────────────────

/**
 * Streams assistant response chunks via SSE (fetch + ReadableStream).
 * We use fetch instead of EventSource because EventSource does not support
 * custom request headers and we need X-Session-Token.
 *
 * Yields parsed StreamEventPayload objects as they arrive.
 */
export async function* streamMessages(
  embedToken: string,
  sessionId: string,
  sessionToken: string,
  content: string,
): AsyncGenerator<StreamEventPayload, void, unknown> {
  const query = encodeURIComponent(JSON.stringify({ payload: { content } }))
  const url = `${API_BASE}/public/agents/${embedToken}/sessions/${sessionId}/messages/stream?q=${query}`

  const response = await fetch(url, {
    headers: { "X-Session-Token": sessionToken, Accept: "text/event-stream" },
  })
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
          yield JSON.parse(raw) as StreamEventPayload
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
}
