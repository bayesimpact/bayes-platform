import type { LanguageModelV3StreamPart } from "@ai-sdk/provider"

/**
 * Emits the tool call a provider dropped because its arguments never became
 * valid JSON.
 *
 * The OpenAI chat provider of the AI SDK streams a tool call's arguments as
 * `tool-input-start` / `tool-input-delta` parts and emits the `tool-call`
 * part only once the accumulated arguments parse as JSON. When the model
 * (Gemma on a long form) breaks the JSON, the call is never emitted: no
 * tool result, no error, no retry, and the turn ends on an empty reply.
 *
 * This tracker watches the stream and, on `finish`, emits the missing
 * `tool-call` with the raw arguments. The SDK then rejects the arguments,
 * which hands them to the repair function, or, failing that, tells the
 * model with a tool error so it can call again.
 */
export type UnfinishedToolCallTracker = {
  /** Parts to enqueue before `chunk`: the tool calls the provider dropped. */
  before(chunk: LanguageModelV3StreamPart): LanguageModelV3StreamPart[]
  /** Names of the tool calls emitted by the tracker so far. */
  emitted(): string[]
}

export function createUnfinishedToolCallTracker(): UnfinishedToolCallTracker {
  const started = new Map<string, { toolName: string; input: string; ended: boolean }>()
  const called = new Set<string>()
  const emittedToolNames: string[] = []

  const synthesize = (): LanguageModelV3StreamPart[] => {
    const parts: LanguageModelV3StreamPart[] = []
    for (const [id, toolInput] of started) {
      if (called.has(id)) continue
      if (!toolInput.ended) parts.push({ type: "tool-input-end", id })
      parts.push({
        type: "tool-call",
        toolCallId: id,
        toolName: toolInput.toolName,
        input: toolInput.input,
      })
      called.add(id)
      emittedToolNames.push(toolInput.toolName)
    }
    return parts
  }

  return {
    before(chunk) {
      switch (chunk.type) {
        case "tool-input-start":
          if (!chunk.providerExecuted) {
            started.set(chunk.id, { toolName: chunk.toolName, input: "", ended: false })
          }
          return []
        case "tool-input-delta": {
          const toolInput = started.get(chunk.id)
          if (toolInput) toolInput.input += chunk.delta
          return []
        }
        case "tool-input-end": {
          const toolInput = started.get(chunk.id)
          if (toolInput) toolInput.ended = true
          return []
        }
        case "tool-call":
          called.add(chunk.toolCallId)
          return []
        case "finish":
          return synthesize()
        default:
          return []
      }
    },
    emitted() {
      return [...emittedToolNames]
    },
  }
}
