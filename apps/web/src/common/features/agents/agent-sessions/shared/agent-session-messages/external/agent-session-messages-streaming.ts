import { runtimeConfig } from "@/config/runtime-config"
import { getAccessToken } from "@/external/auth0Client"
import {
  processSSEChunk,
  type StreamContext,
  type StreamEventHandler,
} from "./agent-session-messages-streaming-events"
import { buildStreamUrl } from "./agent-session-messages-streaming-url"

export type { StreamEventHandler }

/**
 * Streams a chat response using Server-Sent Events (SSE).
 * Uses fetch instead of EventSource to support Authorization headers.
 *
 * `assistantMessageId` is the optimistic message the answer is being written into: error frames
 * come back without a message id, so they are attributed to it until a frame names the persisted
 * message instead.
 */
export async function streamChatResponse({
  organizationId,
  projectId,
  agentId,
  agentSessionId,
  content,
  attachmentDocumentId,
  agentSettingsRevision,
  assistantMessageId,
  handlers,
  signal,
}: {
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
  content: string
  attachmentDocumentId?: string
  agentSettingsRevision?: number
  assistantMessageId: string
  handlers: StreamEventHandler
  signal?: AbortSignal
}): Promise<void> {
  try {
    const token = await getAccessToken()
    if (!token) throw new Error("No access token available")

    const baseURL = runtimeConfig.apiUrl

    const url = buildStreamUrl({
      baseURL,
      organizationId,
      projectId,
      agentId,
      agentSessionId,
      content,
      attachmentDocumentId,
      agentSettingsRevision,
    })

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(`Streaming failed: ${response.status} ${errorText}`)
    }
    if (!response.body) throw new Error("Response body is null")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const context: StreamContext = { messageId: assistantMessageId }
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Flush any remaining buffered events
          if (buffer.trim()) processSSEChunk(`${buffer}\n\n`, handlers, context)
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const result = processSSEChunk(buffer, handlers, context)
        buffer = result.remaining
        if (result.done) return
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    throw new Error("Fail to stream", { cause: error })
  }
}
