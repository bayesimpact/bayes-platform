import { useEffect, useEffectEvent, useState } from "react"
import {
  CITED_HIGHLIGHT,
  clearQuoteHighlights,
  findPassage,
  indexPassages,
  isPointInRange,
  JUMPED_HIGHLIGHT,
  type PassageIndex,
  showQuoteHighlights,
} from "@/lib/quote-highlight"
import { CITED_PASSAGE_ATTRIBUTE, citedPassagesOf, QUOTABLE_ATTRIBUTE } from "../annotation"
import type { ChatMessage } from "../chat-messages"
import type { ReplyClick } from "./use-settled-selection"

/** How long the passage or the chip a person jumped to stands out. */
const JUMP_IN_MILLISECONDS = 1500

/** A passage found in a reply: where it stands, the message that quotes it, and its number. */
type FoundPassage = { range: Range; messageId: string; number: number }

/** A jump between a chip and its passage, which stands out a moment: the chip or the passage. */
type Jump = { chipKey: string | null; passage: Range | null }

/**
 * The passages the person's messages quote, highlighted in the replies they come from, and the
 * jumps between a chip and its passage. The replies render in the browser, outside React: an
 * observer finds the passages again each time their text changes, as when code gets its colors,
 * in `layer`, the element the conversation's messages render in.
 */
export function useCitedPassages(messages: ChatMessage[], layer: HTMLElement | null) {
  const citedPassages = citedPassagesOf(messages)
  // The passages found, by their key: the chips of the others jump nowhere.
  const [found, setFound] = useState(new Map<string, FoundPassage>())
  const [jump, setJump] = useState<Jump | null>(null)
  // The messages a jump unfolded, so their chip shows.
  const [unfoldedIds, setUnfoldedIds] = useState<string[]>([])

  const findPassages = useEffectEvent((root: HTMLElement) => {
    const replies = new Map<string, HTMLElement>()
    for (const reply of root.querySelectorAll<HTMLElement>(`[${QUOTABLE_ATTRIBUTE}]`)) {
      replies.set(reply.getAttribute(QUOTABLE_ATTRIBUTE) ?? "", reply)
    }
    // Each reply's text is read once, however many passages are searched in it.
    const indexes = new Map<string, PassageIndex>()
    const indexOf = (replyId: string) => {
      const reply = replies.get(replyId)
      if (!reply) return null
      const index = indexes.get(replyId) ?? indexPassages(reply)
      indexes.set(replyId, index)
      return index
    }
    const passages = new Map<string, FoundPassage>()
    for (const cited of citedPassages) {
      for (const replyId of cited.replyIds) {
        const index = indexOf(replyId)
        const range = index ? findPassage(index, cited.passage, cited.occurrence) : null
        if (range) {
          passages.set(cited.key, { range, messageId: cited.messageId, number: cited.number })
          break
        }
      }
    }
    showQuoteHighlights(
      [...passages.values()].map((passage) => passage.range),
      CITED_HIGHLIGHT,
    )
    setFound(passages)
  })

  useEffect(() => {
    if (!layer) return
    let frame = requestAnimationFrame(() => findPassages(layer))
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => findPassages(layer))
    })
    observer.observe(layer, { subtree: true, childList: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      clearQuoteHighlights(CITED_HIGHLIGHT)
    }
  }, [layer])

  // A jump stands out a moment, on a timer of the browser, then fades back.
  useEffect(() => {
    if (!jump) return
    showQuoteHighlights(jump.passage ? [jump.passage] : [], JUMPED_HIGHLIGHT)
    const timer = setTimeout(() => setJump(null), JUMP_IN_MILLISECONDS)
    return () => {
      clearTimeout(timer)
      clearQuoteHighlights(JUMPED_HIGHLIGHT)
    }
  }, [jump])

  const showChip = (chipKey: string) => {
    const passage = found.get(chipKey)
    if (!passage || !layer) return
    const { messageId } = passage
    setUnfoldedIds((current) => (current.includes(messageId) ? current : [...current, messageId]))
    setJump({ chipKey, passage: null })
    // Once its message unfolded, the chip shows where it stands.
    requestAnimationFrame(() => {
      const chip = Array.from(
        layer.querySelectorAll<HTMLElement>(`[${CITED_PASSAGE_ATTRIBUTE}]`),
      ).find((element) => element.getAttribute(CITED_PASSAGE_ATTRIBUTE) === chipKey)
      chip?.scrollIntoView({ block: "center", behavior: "smooth" })
    })
  }

  return {
    foundKeys: [...found.keys()],
    /** The passages found, with their number and where they stand, for their bubbles. */
    numbered: [...found].map(([key, { range, number }]) => ({ key, range, number })),
    /** The number of the next annotation, after every passage the messages quote. */
    nextNumber: citedPassages.length + 1,
    jumpedKey: jump?.chipKey ?? null,
    unfoldedIds,
    /** Scrolls to the passage a chip quotes, which stands out a moment. */
    showPassage: (key: string) => {
      const passage = found.get(key)?.range
      if (!passage) return
      passage.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" })
      setJump({ chipKey: null, passage })
    },
    /** Scrolls to the chip that quotes a passage, which stands out a moment. */
    showChip,
    /** Scrolls from a click on a quoted passage to the chip that quotes it, the latest first. */
    showChipAt: (click: ReplyClick) => {
      const chipKey = [...found]
        .reverse()
        .find(([, { range }]) => isPointInRange(range, click.x, click.y))?.[0]
      if (chipKey) showChip(chipKey)
    },
  }
}

export type CitedPassages = ReturnType<typeof useCitedPassages>
