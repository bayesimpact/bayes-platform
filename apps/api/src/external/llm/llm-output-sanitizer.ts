// Channel-name keywords that Gemma 4 / GPT-OSS-style models emit as the name
// inside `<|channel>name<channel|>` openers. When such a name appears as a
// bare standalone line (between two marker pairs, after the opener has been
// stripped), we treat it as leaked-marker content and drop it too.
const CHANNEL_KEYWORDS = "thought|analysis|reasoning|finalize|commentary|final"

// Hallucinated tool-call syntax that Gemini models (lite especially) leak
// into the TEXT stream instead of emitting a real functionCall, e.g.
// `<call:default_api:some_tool xmlns:default_api=... />` or
// `<function:default_api:some_tool{args}` (brace-terminated, no `>` at all),
// or even `Lie:default_api:some_tool{args}` (no `<` at all: the namespace is
// glued to a garbled word, and only the argument braces delimit the call).
// `default_api` is an internal Gemini tool namespace; none of these tags can
// ever be legitimate user-facing content. A tag is complete either at its
// closing `>` or, for the brace variant, at the `}` that closes its (flat)
// argument object — with an optional `/>` glued right after.
//
// Newest variant (Gemma, production): the bare tool name glued to its
// argument object, `mandatory_tool{categoryNames:[...],suggestedTitle:...}`.
// No `<`, no `call:`, no `default_api:` — the only shape left is
// `identifier{key:value,...}`. The match is tool-name agnostic on purpose:
// the model can hallucinate the name too, and a leaked call to an unknown
// tool must still be hidden (recovery then reports it as undeclared). The
// argument object must start with a `key:` so prose such as
// `function foo() {}` or `{a, b}` never matches; the identifier must not be
// glued to a preceding word char, `:` or `.` (a `default_api:` prefix stays
// with the family above, which also removes the prefix).
const BARE_CALL = String.raw`(?<![\w:.])[a-zA-Z_][a-zA-Z0-9_]*\{\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*:[^{}]*)?\}\/?>?`
const BARE_CALL_OPEN = String.raw`(?<![\w:.])[a-zA-Z_][a-zA-Z0-9_]*\{\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*:[^}]*)?$`
// Gemma variant: the bare tool name in square brackets, `[concludeHandoff]`,
// written as a marker at the end of the message instead of calling the tool.
// A camelCase identifier (one inner capital at least) keeps citations `[1]`
// and plain words out; a following `(` or `[` is a markdown link, kept.
const BRACKET_CALL = String.raw`\[([a-z][a-z0-9]*[A-Z][a-zA-Z0-9_]*)\](?![(\[])`
const PSEUDO_TOOL_CALL_RE = new RegExp(
  String.raw`<\/?(?:call|function|default_api)[:\s](?:[^>{]*\{[^{}]*\}\/?>?|[^>]*\/?>)|(?:[^\s<>{}]*:)?default_api:[^\s<>{}]*\{[^{}]*\}\/?>?|${BARE_CALL}|${BRACKET_CALL}`,
  "g",
)
// An opener of that family that has no closer yet (still streaming): no `>`
// for the tag variants, no `}` for the brace variants.
const PSEUDO_TOOL_CALL_OPEN_RE = new RegExp(
  String.raw`<\/?(?:call|function|default_api)[:\s][^>]*$|(?:[^\s<>{}]*:)?default_api:[^}]*$|${BARE_CALL_OPEN}`,
  "i",
)
// Give up holding the stream back after this many buffered characters: a
// legitimate `<call:`-looking text (vanishingly unlikely) must not stall the
// stream forever.
const PSEUDO_TOOL_CALL_MAX_LEN = 600

// Composite removals that need a full self-contained match. Safe to run on a
// partial streaming buffer because they only fire once both ends are present.
function stripPairedChannelMarkers(text: string): string {
  return (
    text
      // Hallucinated tool-call tags verbalized into the text
      .replace(PSEUDO_TOOL_CALL_RE, "")
      // The wrapper a model puts around such a call (`<code>…</code>`, a
      // fenced block) is left empty by the removal above: drop it too.
      .replace(/<code>\s*<\/code>/gi, "")
      .replace(/```[a-z]*\s*```/gi, "")
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

/**
 * A tool call the model VERBALIZED in the text channel instead of emitting
 * it (documented Gemini failure family): the call never reached the tool
 * channel, so the platform did NOT execute it. `raw` keeps the whole leaked
 * tag — it already carries the arguments the model intended, in a malformed
 * form, which is what makes recovery possible.
 */
export type LeakedToolCall = {
  name: string
  raw: string
}

export function findLeakedToolCalls(text: string): LeakedToolCall[] {
  const byName = new Map<string, LeakedToolCall>()
  // The leaked tag is malformed and comes in variants; the tool name is the
  // last `:`-separated segment of the tag opener, before its arguments
  // (`{...}`, ` attr=...`, or the closing `>`).
  for (const match of text.matchAll(PSEUDO_TOOL_CALL_RE)) {
    const raw = match[0]
    const opener =
      /(?:<\/?(?:call|function)[:\s]|<?\/?(?:[^\s<>{}]*:)?default_api[:\s])([^>{(\s]+)/i.exec(raw)
    // Bare `identifier{...}` variant: the identifier is the tool name.
    const bareName = opener === null ? /^[a-zA-Z_][a-zA-Z0-9_]*(?=\{)/.exec(raw)?.[0] : undefined
    // Bracketed `[identifier]` variant.
    const bracketName =
      opener === null ? /^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/.exec(raw)?.[1] : undefined
    const segments = (opener?.[1] ?? bareName ?? bracketName ?? "").split(":").filter(Boolean)
    const name = segments.at(-1)
    if (name && name !== "default_api" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      if (!byName.has(name)) byName.set(name, { name, raw })
    }
  }
  return [...byName.values()]
}

export function findLeakedToolCallNames(text: string): string[] {
  return findLeakedToolCalls(text).map((leakedCall) => leakedCall.name)
}

// biome-ignore lint/complexity/noStaticOnlyClass: helper
export class LLMOutputSanitizer {
  /**
   * One-shot removal of everything a model leaks into its user-visible text
   * that is not content: thought tokens (`<|channel>...<channel|>`,
   * `<unusedN>thought ...`, `<|...>`, `<...|>`, `<unusedN>`) and tool calls
   * verbalized in the text channel (see `PSEUDO_TOOL_CALL_RE`). Use `createStreamSanitizer()` for streaming.
   */
  static sanitize(text: string): string {
    return stripStrayChannelTokens(stripPairedChannelMarkers(text))
  }

  /**
   * Streaming-safe sanitizer. A marker like `<|channel>thought<channel|>` can
   * be split across multiple stream deltas, so we cannot regex each delta in
   * isolation. This holds back a small tail of the most recent text until we
   * are confident no marker is still mid-emission, then emits the cleaned
   * prefix. Call `flush()` at end of stream.
   */
  static createStreamSanitizer() {
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
        // A pseudo tool-call tag can be far longer than MAX_MARKER_LEN: if
        // one is still open in the buffer, hold everything back from its
        // `<` (bounded — a never-closing lookalike must not stall the stream).
        const pseudoOpen = pending.search(PSEUDO_TOOL_CALL_OPEN_RE)
        if (pseudoOpen !== -1 && pending.length - pseudoOpen < PSEUDO_TOOL_CALL_MAX_LEN) {
          safeUntil = Math.min(safeUntil, pseudoOpen)
        }
        const ltBeforeCut = Math.max(
          pending.lastIndexOf("<", safeUntil - 1),
          pending.lastIndexOf("[", safeUntil - 1),
        )
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
