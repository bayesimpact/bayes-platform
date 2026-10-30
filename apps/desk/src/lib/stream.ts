/** One server-sent event: its `event:` name when it has one, and its `data:` lines joined. */
export type ServerSentEvent = {
  event: string | null
  data: string
}

/**
 * Reads server-sent events from a response body, as they arrive. Frames end with a blank line;
 * `id:`, `retry:` and comment lines, which Nest writes too, are skipped. A frame with neither data
 * nor an event name is dropped. Line ends may be `\n`, `\r\n` or `\r`, even split across chunks.
 */
export async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  // A chunk that ends with "\r" may end in the middle of a "\r\n": it waits for the next one.
  let pendingCarriageReturn = ""
  let isDone = false
  const append = (text: string) => {
    const pending = pendingCarriageReturn + text
    pendingCarriageReturn = pending.endsWith("\r") ? "\r" : ""
    const complete = pendingCarriageReturn ? pending.slice(0, -1) : pending
    buffer += complete.replace(/\r\n?/g, "\n")
  }
  // The frames the buffer holds whole, which leave it.
  function* takeFrames(): Generator<ServerSentEvent> {
    let frameEnd = buffer.indexOf("\n\n")
    while (frameEnd !== -1) {
      const frame = parseFrame(buffer.slice(0, frameEnd))
      buffer = buffer.slice(frameEnd + 2)
      if (frame) yield frame
      frameEnd = buffer.indexOf("\n\n")
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      isDone = done
      if (done) break
      append(decoder.decode(value, { stream: true }))
      yield* takeFrames()
    }
    // The decoder's last bytes, and a "\r" that ended the body, end their lines.
    append(decoder.decode())
    buffer += pendingCarriageReturn ? "\n" : ""
    yield* takeFrames()
    const lastFrame = parseFrame(buffer)
    if (lastFrame) yield lastFrame
  } finally {
    // A reader that stops early, on an error event or a broken frame, closes the connection too:
    // the server would otherwise keep writing to it.
    if (!isDone) await reader.cancel()
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
