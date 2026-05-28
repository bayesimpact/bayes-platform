// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class ResponseHelper {
  static groupStreamChunksForReadability(chunks: unknown[]): unknown[] {
    const grouped: unknown[] = []
    type DeltaKind = "text" | "tool-input" | "reasoning"
    type Buffer = {
      kind: DeltaKind
      id?: string
      text: string
      // biome-ignore lint/suspicious/noExplicitAny: passthrough metadata varies
      extra?: Record<string, any>
    }
    let buffer: Buffer | null = null

    const startedField: Record<DeltaKind, string> = {
      text: "text",
      "tool-input": "input",
      reasoning: "text",
    }

    const flushBuffer = () => {
      if (buffer !== null) {
        grouped.push({
          type: `${buffer.kind}-stream-collapsed`,
          ...(buffer.id !== undefined ? { id: buffer.id } : {}),
          ...buffer.extra,
          [startedField[buffer.kind]]: buffer.text,
        })
        buffer = null
      }
    }

    const startBuffer = (kind: DeltaKind, c: Record<string, unknown>) => {
      flushBuffer()
      const { type: _ignored, id, delta: _ignored2, ...extra } = c
      buffer = { kind, id: typeof id === "string" ? id : undefined, text: "", extra }
    }

    const appendDelta = (kind: DeltaKind, c: Record<string, unknown>) => {
      if (buffer === null || buffer.kind !== kind) {
        startBuffer(kind, c)
      }
      if (buffer !== null && typeof c.delta === "string") {
        buffer.text += c.delta
      }
    }

    for (const chunk of chunks) {
      // biome-ignore lint/suspicious/noExplicitAny: stream chunk shape varies by provider
      const c = chunk as any
      switch (c?.type) {
        case "text-start":
          startBuffer("text", c)
          break
        case "text-delta":
          appendDelta("text", c)
          break
        case "text-end":
          flushBuffer()
          break
        case "tool-input-start":
          startBuffer("tool-input", c)
          break
        case "tool-input-delta":
          appendDelta("tool-input", c)
          break
        case "tool-input-end":
          flushBuffer()
          break
        case "reasoning-start":
          startBuffer("reasoning", c)
          break
        case "reasoning-delta":
          appendDelta("reasoning", c)
          break
        case "reasoning-end":
          flushBuffer()
          break
        default:
          flushBuffer()
          grouped.push(chunk)
      }
    }
    flushBuffer()
    return grouped
  }
}