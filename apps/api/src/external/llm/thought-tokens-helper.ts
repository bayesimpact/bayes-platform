// Channel-name keywords that Gemma 4 / GPT-OSS-style models emit as the name
// inside `<|channel>name<channel|>` openers. When such a name appears as a
// bare standalone line (between two marker pairs, after the opener has been
// stripped), we treat it as leaked-marker content and drop it too.
const CHANNEL_KEYWORDS = "thought|analysis|reasoning|finalize|commentary|final"

// Composite removals that need a full self-contained match. Safe to run on a
// partial streaming buffer because they only fire once both ends are present.
function stripPairedChannelMarkers(text: string): string {
  return (
    text
      // <|channel>thought<channel|> ... <channel|> (eats nested openers too)
      .replace(new RegExp(`<\\|channel>(?:${CHANNEL_KEYWORDS})[\\s\\S]*?<channel\\|>`, "gi"), "")
      // Gemma 3 legacy: <unused N>thought ... <unused N>
      .replace(/<unused\d+>thought[\s\S]*?(?=<unused\d+>)/gi, "")
      // Bare keyword lines left behind between paired markers
      // (e.g. "thought\n" sitting between two stripped `<|channel>...<channel|>`).
      .replace(new RegExp(`^(?:${CHANNEL_KEYWORDS})\\s*\\n`, "gim"), "")
  )
}

// Single-token removals. DANGEROUS to run on a partial streaming buffer
// because they would consume one half of a marker that is still being
// streamed. Apply only to text we are committing to emit / at flush time.
function stripStrayChannelTokens(text: string): string {
  return text
    .replace(/<\|"\|>/g, "")
    .replace(/<\|[a-z0-9_-]*>/gi, "")
    .replace(/<[a-z0-9_-]*\|>/gi, "")
    .replace(/<unused\d+>/g, "")
}

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class ThoughtTokensHelper {
  /**
   * One-shot removal of all thought-tokens (`<|channel>...<channel|>`,
   * `<unusedN>thought ...`, `<|...>`, `<...|>`, `<unusedN>`) from a complete
   * text string. Use `createStripper()` for streaming.
   */
  static removeThoughtTokens(text: string): string {
    return stripStrayChannelTokens(stripPairedChannelMarkers(text))
  }

  /**
   * Streaming-safe stripper. A marker like `<|channel>thought<channel|>` can
   * be split across multiple stream deltas, so we cannot regex each delta in
   * isolation. This holds back a small tail of the most recent text until we
   * are confident no marker is still mid-emission, then emits the cleaned
   * prefix. Call `flush()` at end of stream.
   */
  static createStripper() {
    let pending = ""
    // How many trailing characters to hold back from emission. Must be longer
    // than the longest marker we might want to recognise once its closer
    // arrives, so an in-progress marker is never split across two emits.
    const HOLD_TAIL = 64
    // Upper bound on the length of any single marker. When the planned cut
    // point falls within this many characters of an earlier `<`, we MUST pull
    // the cut back to that `<`: otherwise we would emit a partial marker.
    const MAX_MARKER_LEN = 32

    return {
      feed(chunk: string): string {
        pending += chunk
        // Strip any FULLY PAIRED markers from the buffer. Safe mid-stream:
        // paired regexes only fire once both ends are present.
        pending = stripPairedChannelMarkers(pending)

        let safeUntil = pending.length - HOLD_TAIL
        if (safeUntil <= 0) return ""
        const ltBeforeCut = pending.lastIndexOf("<", safeUntil - 1)
        if (ltBeforeCut !== -1 && safeUntil - ltBeforeCut < MAX_MARKER_LEN) {
          safeUntil = ltBeforeCut
        }
        if (safeUntil <= 0) return ""

        const emit = stripStrayChannelTokens(pending.slice(0, safeUntil))
        pending = pending.slice(safeUntil)
        return emit
      },
      flush(): string {
        const tail = stripStrayChannelTokens(stripPairedChannelMarkers(pending))
        pending = ""
        return tail
      },
    }
  }
}
