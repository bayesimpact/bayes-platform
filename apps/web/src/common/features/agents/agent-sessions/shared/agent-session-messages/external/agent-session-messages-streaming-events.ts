import type { StreamEventPayload } from "@caseai-connect/api-contracts"

/**
 * Parsing and dispatch of the chat SSE frames, kept apart from the reader so it can be tested
 * without the Auth0 client the transport pulls in (same reason as
 * `agent-session-messages-streaming-url.ts`).
 *
 * Handlers are typed on `StreamEventPayload`, the wire shape, rather than on the `MessageEvent`
 * intersection the server builds its frames from: the client only ever sees the payload.
 */
export type StreamEventHandler = {
  onStart: (event: Extract<StreamEventPayload, { type: "start" }>) => void
  onChunk: (event: Extract<StreamEventPayload, { type: "chunk" }>) => void
  onNotifyClient: (event: Extract<StreamEventPayload, { type: "notify_client" }>) => void
  onEnd: (event: Extract<StreamEventPayload, { type: "end" }>) => void
  onError: (event: Extract<StreamEventPayload, { type: "error" }>) => void
}

/**
 * Message the frames are attributed to: the optimistic id the caller created, replaced by the
 * persisted one as soon as a frame names it. Error frames written by Nest carry no message id,
 * so they borrow this one.
 */
export type StreamContext = { messageId: string }

/** Shown when the server reports a failure with no message of its own. */
const unknownStreamError = "The agent stopped responding"

/** Values of every `<field>:` line of a frame, with the single optional leading space stripped. */
function readField(eventText: string, field: string): string[] {
  return eventText
    .split("\n")
    .filter((line) => line.startsWith(`${field}:`))
    .map((line) => {
      const value = line.slice(field.length + 1)
      return value.startsWith(" ") ? value.slice(1) : value
    })
}

export function parseSSEEvent(
  eventText: string,
  context: StreamContext,
): StreamEventPayload | null {
  const dataLines = readField(eventText, "data")
  const data = dataLines.join("\n")

  // Nest turns anything the SSE handler throws into `event: error` with the raw message as data —
  // a bare string, never JSON. The events the app emits itself carry no `event:` line at all, so
  // the line is what identifies the frame. Parsing it would throw, drop the frame, and leave the
  // caller waiting for a terminal event that never comes. Checked before the no-data early return:
  // Nest omits the `data:` line entirely when the thrown error's message is falsy.
  if (readField(eventText, "event")[0] === "error") {
    return { type: "error", messageId: context.messageId, error: data || unknownStreamError }
  }

  if (dataLines.length === 0) return null

  try {
    return JSON.parse(data) as StreamEventPayload
  } catch (parseError) {
    console.error("Failed to parse SSE event:", parseError, "Data:", data)
    return null
  }
}

/**
 * Returns true if the whole connection should stop being read. Only `error` qualifies: a turn
 * that auto-continues into a freshly-activated handoff child (see streaming.controller.ts) sends
 * more than one `start`/.../`end` sequence over the SAME connection, one per assistant message,
 * so an individual message's `end` must NOT stop reading — the next message's frames may already
 * be sitting in the same buffered chunk right after it. The connection's real end is signalled by
 * the underlying reader reporting `done` (see agent-session-messages-streaming.ts), not by any
 * one message's `end` event.
 */
export function dispatchStreamEvent(
  event: StreamEventPayload,
  handlers: StreamEventHandler,
  context: StreamContext,
): boolean {
  // The server's `notify_client` frames carry a message id, so the optimistic one can be replaced with the persisted one. The other frames don't, so they borrow the optimistic one until a frame names the persisted one.
  if (event.type !== "notify_client") context.messageId = event.messageId

  if (event.type === "start") handlers.onStart(event)
  else if (event.type === "chunk") handlers.onChunk(event)
  else if (event.type === "notify_client") handlers.onNotifyClient(event)
  else if (event.type === "end") handlers.onEnd(event)
  else if (event.type === "error") {
    handlers.onError(event)
    return true
  }
  return false
}

export function processSSEChunk(
  chunk: string,
  handlers: StreamEventHandler,
  context: StreamContext,
): { remaining: string; done: boolean } {
  const parts = chunk.split("\n\n")
  const remaining = parts.pop() ?? ""

  for (const eventText of parts) {
    if (!eventText.trim()) continue
    const event = parseSSEEvent(eventText, context)
    if (event && dispatchStreamEvent(event, handlers, context)) return { remaining, done: true }
  }

  return { remaining, done: false }
}
