import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import { useId, useRef, useState } from "react"
import { InlineCode } from "@/components/shared/InlineCode"
import { Button } from "@/components/ui/button"
import { messageSegmentsOf } from "../annotation"
import { useIsOverflowing } from "../hooks/use-is-overflowing"

export type UserMessageTextProps = {
  content: string
}

/**
 * The text of the person's message, collapsed past about ten lines, as in the Claude app: it fades
 * out at the bottom, and a button lets it out in full or folds it back. The passages between
 * backticks, such as the ones quoted from a reply, show as chips.
 */
export function UserMessageText({ content }: UserMessageTextProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const textId = useId()
  const [isExpanded, setIsExpanded] = useState(false)
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
          {messageSegmentsOf(content).map((segment, position) =>
            segment.kind === "code" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the segments of one message never move.
              <InlineCode key={position}>{segment.text}</InlineCode>
            ) : (
              segment.text
            ),
          )}
        </div>
      </div>
      {isOverflowing ? (
        <Button
          variant="link"
          size="xs"
          aria-expanded={isExpanded}
          aria-controls={textId}
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-1 h-auto px-0 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <Trans>Show less</Trans> : <Trans>Show more</Trans>}
        </Button>
      ) : null}
    </>
  )
}
