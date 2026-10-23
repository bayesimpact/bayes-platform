import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import { useId, useRef, useState } from "react"
import { InlineCode } from "@/components/shared/InlineCode"
import { Button } from "@/components/ui/button"
import { citedPassageKey, messageSegmentsOf } from "../annotation"
import type { CitedPassages } from "../hooks/use-cited-passages"
import { useIsOverflowing } from "../hooks/use-is-overflowing"
import { CitedPassageChip } from "./CitedPassageChip"

export type UserMessageTextProps = {
  messageId: string
  content: string
  citedPassages: CitedPassages
}

/**
 * The text of the person's message, collapsed past about ten lines, as in the Claude app: it fades
 * out at the bottom, and a button lets it out in full or folds it back. The passages between
 * The passages quoted from a reply and the code between backticks show as chips: a quoted
 * passage found in its reply jumps to where it stands there, and a jump back from that passage
 * unfolds the message.
 */
export function UserMessageText({ messageId, content, citedPassages }: UserMessageTextProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const textId = useId()
  // The person's own choice, else unfolded once a jump came to one of its chips.
  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null)
  const isExpanded = expandedChoice ?? citedPassages.unfoldedIds.includes(messageId)
  const isOverflowing = useIsOverflowing(textRef, !isExpanded)
  const isCollapsed = isOverflowing && !isExpanded

  return (
    <>
      <div
        ref={textRef}
        id={textId}
        className={cn(
          "whitespace-pre-wrap",
          !isExpanded && "max-h-64 overflow-hidden",
          isCollapsed && "mask-b-from-60%",
        )}
      >
        <div>
          {messageSegmentsOf(content).map((segment, position) => {
            if (segment.kind === "text") return segment.text
            const key = citedPassageKey(messageId, position)
            return citedPassages.foundKeys.includes(key) ? (
              <CitedPassageChip
                key={key}
                passage={segment.text}
                citedKey={key}
                isJumpedTo={citedPassages.jumpedKey === key}
                onShow={() => citedPassages.showPassage(key)}
              />
            ) : (
              <InlineCode key={key}>{segment.text}</InlineCode>
            )
          })}
        </div>
      </div>
      {isOverflowing ? (
        <Button
          variant="link"
          size="xs"
          aria-expanded={isExpanded}
          aria-controls={textId}
          onClick={() => setExpandedChoice(!isExpanded)}
          className="mt-1 h-auto px-0 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <Trans>Show less</Trans> : <Trans>Show more</Trans>}
        </Button>
      ) : null}
    </>
  )
}
