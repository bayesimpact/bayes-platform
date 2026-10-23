import { indexPassages, occurrenceAt } from "@/lib/quote-highlight"
import { isLocalMessageId } from "./chat-messages"

/** The attribute that marks the text of a reply the person can quote, set to the reply's id. */
export const QUOTABLE_ATTRIBUTE = "data-quotable"

/** The attribute of a chip that jumps to the passage it quotes, set to the passage's key. */
export const CITED_PASSAGE_ATTRIBUTE = "data-cited-passage"

/**
 * The attribute of the element the numbers of annotations are drawn in, around every message: a
 * message clips what overflows it, as a number raised above a first line would.
 */
export const ANNOTATION_LAYER_ATTRIBUTE = "data-annotation-layer"

/**
 * A passage of a reply the person annotated, waiting to be sent with their next message: where it
 * stands, to keep it highlighted, the element its number is drawn in, which scrolls with it, and
 * where it comes from, which the message names.
 */
export type Annotation = {
  id: string
  passage: string
  note: string
  range: Range
  layer: HTMLElement
  /** The text of the reply, whose id is read when the message leaves: a reply gets its own once saved. */
  reply: HTMLElement
  /** Which occurrence of the passage's text in the reply, from 1. */
  occurrence: number
}

/**
 * Where an annotation's passage comes from, as the message names it: unknown while the reply has
 * no id of the server's yet.
 */
export function quoteSourceOf(
  annotation: Pick<Annotation, "reply" | "occurrence">,
): QuoteSource | null {
  const replyId = annotation.reply.getAttribute(QUOTABLE_ATTRIBUTE)
  if (!replyId || isLocalMessageId(replyId)) return null
  return { replyId, occurrence: annotation.occurrence }
}

/**
 * The tags around a passage the person quoted from a reply, in the text of their message: a
 * person never types them, unlike backticks, which mark the code they write. The agent reads
 * them as a quote.
 */
const QUOTE_OPEN = "<quote>"
const QUOTE_CLOSE = "</quote>"

/**
 * Where a passage comes from: the reply, and which occurrence of the passage's text in it, from
 * 1. A text can stand several times in a reply, or inside a longer word, as `change` does in
 * `changed`: the occurrence tells them apart.
 */
export type QuoteSource = { replyId: string; occurrence: number }

/**
 * A passage of a reply and the person's note on it, as one line of their message: the passage
 * between quote tags, which name where it comes from when that is known, then the note. The
 * passage holds on one line, and a closing tag inside it gets a space, so it cannot close early.
 */
export function annotationLine(
  passage: string,
  note: string,
  source: QuoteSource | null = null,
): string {
  const quoted = passage.replace(/\s+/g, " ").trim().replaceAll(QUOTE_CLOSE, "</ quote>")
  const trimmedNote = note.trim()
  const open = source
    ? `<quote reply="${source.replyId}" occurrence="${source.occurrence}">`
    : QUOTE_OPEN
  const line = `${open}${quoted}${QUOTE_CLOSE}`
  return trimmedNote === "" ? line : `${line} ${trimmedNote}`
}

/**
 * A piece of a person's message: plain text, code they put between backticks, or a passage they
 * quoted from a reply, with where it comes from when the message names it.
 */
export type MessageSegment =
  | { kind: "text" | "code"; text: string }
  | { kind: "quote"; text: string; source: QuoteSource | null }

/**
 * A line of text cut into its plain text and its code between backticks. A backtick left open
 * stays plain text.
 */
export function codeSegmentsOf(text: string): MessageSegment[] {
  return text
    .split(/`([^`\n]+)`/)
    .flatMap((piece, index): MessageSegment[] =>
      piece === "" ? [] : [{ kind: index % 2 === 1 ? "code" : "text", text: piece }],
    )
}

/** A quoted passage in a message: its source's two attributes, if any, then its text. */
const QUOTE_PATTERN = /<quote(?: reply="([^"\n]+)" occurrence="(\d+)")?>([^\n]+?)<\/quote>/g

/**
 * A person's message cut into its plain text, the passages they quoted from a reply and the code
 * they wrote, which the conversation shows as chips.
 */
export function messageSegmentsOf(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let textStart = 0
  for (const match of content.matchAll(QUOTE_PATTERN)) {
    const [whole, replyId, occurrence, passage = ""] = match
    segments.push(...codeSegmentsOf(content.slice(textStart, match.index)))
    segments.push({
      kind: "quote",
      text: passage,
      source: replyId && occurrence ? { replyId, occurrence: Number(occurrence) } : null,
    })
    textStart = match.index + whole.length
  }
  segments.push(...codeSegmentsOf(content.slice(textStart)))
  return segments
}

/** A passage a person's message quotes from a reply before it, between quote tags. */
export type CitedPassage = {
  /** Its message and its place among the message's segments, unique in the conversation. */
  key: string
  messageId: string
  /** Its place among the segments of `messageSegmentsOf`. */
  position: number
  passage: string
  /**
   * The replies the passage is searched in, in order: the one it names, or else every reply
   * before the message, the nearest first.
   */
  replyIds: string[]
  /** Which occurrence of its text in that reply, from 1: the first when it names no reply. */
  occurrence: number
  /**
   * Its number in the conversation, from 1: the passages are numbered in order across messages,
   * and the annotations waiting for the next message go on from the last.
   */
  number: number
}

/** The key of the passage at that place of a message. */
export function citedPassageKey(messageId: string, position: number): string {
  return `${messageId}:${position}`
}

/** The passages the person's messages quote from the replies before them, in their order. */
export function citedPassagesOf(
  messages: { id: string; role: string; content: string }[],
): CitedPassage[] {
  return messages
    .flatMap((message, index) => {
      if (message.role !== "user") return []
      const replyIds = messages
        .slice(0, index)
        .filter((earlier) => earlier.role === "assistant")
        .map((reply) => reply.id)
        .reverse()
      if (replyIds.length === 0) return []
      return messageSegmentsOf(message.content).flatMap(
        (segment, position): Omit<CitedPassage, "number">[] => {
          if (segment.kind !== "quote") return []
          // A message names its reply since passages are anchored; an older one, or a reply gone,
          // falls back to a search.
          const source =
            segment.source && replyIds.includes(segment.source.replyId) ? segment.source : null
          return [
            {
              key: citedPassageKey(message.id, position),
              messageId: message.id,
              position,
              passage: segment.text,
              replyIds: source ? [source.replyId] : replyIds,
              occurrence: source?.occurrence ?? 1,
            },
          ]
        },
      )
    })
    .map((cited, index) => ({ ...cited, number: index + 1 }))
}

/** The message with one more annotation, on a line of its own after what is written. */
function appendAnnotation(draft: string, line: string): string {
  const written = draft.trimEnd()
  return written === "" ? line : `${written}\n${line}`
}

/**
 * The annotations once this one is saved: in its place, or last when it is new. An annotation
 * whose note is empty is removed, or never added.
 */
export function saveAnnotation<Saved extends { id: string; note: string }>(
  annotations: Saved[],
  annotation: Saved,
): Saved[] {
  if (annotation.note.trim() === "") {
    return annotations.filter((existing) => existing.id !== annotation.id)
  }
  if (!annotations.some((existing) => existing.id === annotation.id)) {
    return [...annotations, annotation]
  }
  return annotations.map((existing) => (existing.id === annotation.id ? annotation : existing))
}

/** The message sent: what the person wrote, then one line per annotation, in their order. */
export function composeMessage(
  draft: string,
  annotations: { passage: string; note: string; source?: QuoteSource | null }[],
): string {
  return annotations.reduce(
    (message, annotation) =>
      appendAnnotation(
        message,
        annotationLine(annotation.passage, annotation.note, annotation.source),
      ),
    draft.trim(),
  )
}

/** Whether two ranges start and end at the same places, as one selection read twice does. */
export function isSameRange(first: Range, second: Range): boolean {
  return (
    first.compareBoundaryPoints(Range.START_TO_START, second) === 0 &&
    first.compareBoundaryPoints(Range.END_TO_END, second) === 0
  )
}

/**
 * The passage of a reply the person selected, with where it stands on the screen, the element its
 * number would be drawn in, its reply and which occurrence of its text there it is, or `null` when
 * the selection is empty or leaves the reply it starts in.
 */
export function readQuotableSelection(
  selection: Selection | null,
): (Pick<Annotation, "range" | "layer" | "reply" | "occurrence"> & { text: string }) | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const text = selection.toString().trim()
  if (text === "") return null
  const quotableOf = (node: Node | null) =>
    (node instanceof Element ? node : node?.parentElement)?.closest(`[${QUOTABLE_ATTRIBUTE}]`)
  const start = quotableOf(selection.anchorNode)
  if (!(start instanceof HTMLElement) || start !== quotableOf(selection.focusNode)) return null
  const layer = start.closest(`[${ANNOTATION_LAYER_ATTRIBUTE}]`)
  const range = selection.getRangeAt(0).cloneRange()
  return {
    text,
    range,
    layer: layer instanceof HTMLElement ? layer : start,
    reply: start,
    occurrence: occurrenceAt(indexPassages(start), text, range),
  }
}
