/**
 * Drops a text block a model repeats after a tool result.
 *
 * Observed with Gemma: the model writes its message and calls a tool in the
 * same step (a hand-over, a conclusion, a form write), then, once the tool
 * result comes back, writes the very same message again in the next step.
 * Both steps stream to the user and are stored as one reply, so the user
 * reads it twice, word for word.
 *
 * Text of a step is held back while it matches the beginning of the previous
 * step's text; it is released as soon as it diverges, and dropped when the
 * step ends while still matching (an identical repeat, or a truncated one).
 * Only an exact repeat is dropped: a step that starts like the previous one
 * and then says something new is streamed whole, a little later.
 */
export type StreamPartLike =
  | { type: "start-step" }
  | { type: "finish-step" }
  | { type: "text-delta"; text: string }
  | { type: string }

export type RepeatedStepTextFilter = {
  /** Text to emit for this part (nothing for non-text parts, or while holding). */
  feed(part: StreamPartLike): string
  /** Text still held at the end of the stream (empty when it was a repeat). */
  flush(): string
  /** The repeated blocks dropped so far, for logging. */
  dropped(): string[]
}

export function createRepeatedStepTextFilter(): RepeatedStepTextFilter {
  let previousStepText = ""
  let currentStepText = ""
  let held = ""
  let holding = false
  const droppedBlocks: string[] = []

  const endStep = (): string => {
    let emitted = ""
    if (holding && held.length > 0) {
      if (previousStepText.startsWith(held)) droppedBlocks.push(held)
      else emitted = held
    }
    if (currentStepText.length > 0) previousStepText = currentStepText
    currentStepText = ""
    held = ""
    holding = false
    return emitted
  }

  return {
    feed(part) {
      switch (part.type) {
        case "start-step":
          currentStepText = ""
          held = ""
          holding = previousStepText.length > 0
          return ""
        case "finish-step":
          return endStep()
        case "text-delta": {
          const text = (part as { text: string }).text
          currentStepText += text
          if (!holding) return text
          held += text
          if (previousStepText.startsWith(held)) return ""
          holding = false
          const release = held
          held = ""
          return release
        }
        default:
          return ""
      }
    },
    flush() {
      return endStep()
    },
    dropped() {
      return [...droppedBlocks]
    },
  }
}
