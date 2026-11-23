/**
 * Inline source citations.
 *
 * The model cites a retrieved passage by writing its alias in square
 * brackets right after the sentence it supports: `[c1]`, `[c1, c3]`. The
 * aliases come from the retrieved-chunks registry (c1, c2, ... assigned by
 * lookup_knowledge_base), so a marker is the only thing the model has to
 * copy and the server resolves it to the real chunk.
 *
 * The markers never reach the user: this module strips them from the text
 * (streamed and persisted) and records which aliases were cited, so the
 * sources panel gets fed from the same signal. A tolerant pattern absorbs the
 * usual small-model variants (spaces, `;` separators, upper case).
 */

// A complete marker: `[c1]`, `[ c1 , c3 ]`, `[c1;c2]`. The blanks around it
// are part of the match so "27 days [c1]." collapses to "27 days." and a
// marker starting a line takes its trailing blanks instead. Newlines are
// deliberately excluded so the line break survives.
const MARKER = String.raw`\[\s*c\d+(?:\s*[,;]\s*c\d+)*\s*\]`
const CITATION_MARKER_RE = new RegExp(String.raw`(?<=^|\n)${MARKER}[ \t]*|[ \t]*${MARKER}`, "gi")
const ALIAS_RE = /c\d+/gi

// A marker is short; an unclosed `[` further back than this is prose.
const MAX_MARKER_LENGTH = 48

export type InlineCitationExtractor = {
  /** Feeds a streamed delta; returns the text safe to emit (markers removed). */
  feed(chunk: string): string
  /** Releases the held-back tail at end of stream (markers removed). */
  flush(): string
  /** The cited aliases, unique, in first-citation order. */
  citedAliases(): string[]
}

/**
 * One-shot variant for a complete text.
 */
export function stripInlineCitations(text: string): { text: string; citedAliases: string[] } {
  const extractor = createInlineCitationExtractor()
  const stripped = extractor.feed(text) + extractor.flush()
  return { text: stripped, citedAliases: extractor.citedAliases() }
}

/**
 * Streaming-safe extractor: a marker can be split across deltas, so the text
 * from an unclosed `[` (and any trailing blanks, which belong to a marker
 * that may follow) is held back until the closer arrives or the stream ends.
 */
export function createInlineCitationExtractor(): InlineCitationExtractor {
  let pending = ""
  const cited: string[] = []

  const stripCompleteMarkers = (text: string): string =>
    text.replace(CITATION_MARKER_RE, (marker) => {
      for (const alias of marker.match(ALIAS_RE) ?? []) {
        const normalized = alias.toLowerCase()
        if (!cited.includes(normalized)) cited.push(normalized)
      }
      return ""
    })

  return {
    feed(chunk) {
      pending = stripCompleteMarkers(pending + chunk)

      let safeUntil = pending.length
      const openBracket = pending.lastIndexOf("[")
      if (
        openBracket !== -1 &&
        pending.length - openBracket < MAX_MARKER_LENGTH &&
        !pending.includes("]", openBracket)
      ) {
        safeUntil = openBracket
      }
      // Blanks right before the cut may precede a marker still to come: hold
      // them so they get stripped together with it.
      while (safeUntil > 0 && (pending[safeUntil - 1] === " " || pending[safeUntil - 1] === "\t")) {
        safeUntil--
      }

      const emit = pending.slice(0, safeUntil)
      pending = pending.slice(safeUntil)
      return emit
    },
    flush() {
      const tail = stripCompleteMarkers(pending)
      pending = ""
      return tail
    },
    citedAliases() {
      return [...cited]
    },
  }
}

/**
 * A no-op extractor for turns without source reporting: the text flows
 * through untouched, so callers use one code path.
 */
export function createPassthroughCitationExtractor(): InlineCitationExtractor {
  return {
    feed: (chunk) => chunk,
    flush: () => "",
    citedAliases: () => [],
  }
}

/**
 * The two texts of a reply: the one stored (markers always removed) and the one sent to
 * the client, which keeps the raw markers when the caller asked for inline citations
 * (public API `citations: "inline"`). Feed it every streamed delta, then flush it.
 */
export type CitationStreamSplitter = {
  /** Returns the text to send for this delta; empty when there is nothing to send yet. */
  feed(rawChunk: string): string
  /** Returns the text still to send at the end of the stream. */
  flush(): string
  /** The text to store, without markers. */
  storedText(): string
  /** Everything sent to the client, which is also the `fullContent` of the `end` event. */
  streamedText(): string
}

export function createCitationStreamSplitter({
  citations,
  inlineCitations,
}: {
  citations: InlineCitationExtractor
  inlineCitations: boolean
}): CitationStreamSplitter {
  let stored = ""
  let streamed = ""
  return {
    feed(rawChunk) {
      const stripped = citations.feed(rawChunk)
      stored += stripped
      const sent = inlineCitations ? rawChunk : stripped
      streamed += sent
      return sent
    },
    flush() {
      const tail = citations.flush()
      stored += tail
      if (inlineCitations) return ""
      streamed += tail
      return tail
    },
    storedText: () => stored,
    streamedText: () => streamed,
  }
}
