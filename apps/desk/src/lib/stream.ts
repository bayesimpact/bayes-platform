/** One server-sent event: its `event:` name when it has one, and its `data:` lines joined. */
export type ServerSentEvent = {
  event: string | null
  data: string
}

/**
 * Reads server-sent events from a response body, as they arrive. Frames end with a blank line;
 * `id:`, `retry:` and comment lines, which Nest writes too, are skipped. A frame with neither data
 * nor an event name is dropped.
 */
export async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n")
      let frameEnd = buffer.indexOf("\n\n")
      while (frameEnd !== -1) {
        const frame = parseFrame(buffer.slice(0, frameEnd))
        buffer = buffer.slice(frameEnd + 2)
        if (frame) yield frame
        frameEnd = buffer.indexOf("\n\n")
      }
    }
    const lastFrame = parseFrame(buffer)
    if (lastFrame) yield lastFrame
  } finally {
    reader.releaseLock()
  }
}

/** The event of one frame's lines, or `null` when it holds neither data nor an event name. */
export function parseFrame(text: string): ServerSentEvent | null {
  let event: string | null = null
  const dataLines: string[] = []
  for (const line of text.split("\n")) {
    const separator = line.indexOf(":")
    // A line that starts with ":" is a comment.
    if (separator === 0 || line === "") continue
    const field = separator === -1 ? line : line.slice(0, separator)
    const rawValue = separator === -1 ? "" : line.slice(separator + 1)
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue
    if (field === "data") dataLines.push(value)
    else if (field === "event") event = value
  }
  if (dataLines.length === 0 && event === null) return null
  return { event, data: dataLines.join("\n") }
}
