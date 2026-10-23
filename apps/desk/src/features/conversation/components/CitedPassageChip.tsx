import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { InlineCode } from "@/components/shared/InlineCode"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CITED_PASSAGE_ATTRIBUTE } from "../annotation"

export type CitedPassageChipProps = {
  passage: string
  /** The passage's key, by which a click on it in the reply finds this chip. */
  citedKey: string
  /** Whether the person just jumped here from the passage, which makes the chip stand out. */
  isJumpedTo: boolean
  onShow: () => void
}

/**
 * A passage the person quoted from a reply, as a chip that scrolls to where it stands there. It
 * takes the yellow of the passage, so the two read as a pair.
 */
export function CitedPassageChip({ passage, citedKey, isJumpedTo, onShow }: CitedPassageChipProps) {
  const { t } = useLingui()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={t`Show in the reply: ${passage}`}
            onClick={onShow}
            {...{ [CITED_PASSAGE_ATTRIBUTE]: citedKey }}
            // Inline, as the chip it holds, so a long passage still wraps with the text. The chip
            // itself shows the hover, the focus and the jump: a ring on the button would double
            // its border.
            className="group inline cursor-pointer text-left focus-visible:outline-none"
          />
        }
      >
        <InlineCode
          className={cn(
            "border-annotation/50 bg-quote-mark transition-colors group-hover:bg-annotation/60 group-focus-visible:ring-2 group-focus-visible:ring-ring",
            isJumpedTo && "bg-annotation/60",
          )}
        >
          {passage}
        </InlineCode>
      </TooltipTrigger>
      <TooltipContent>
        <Trans>Show in the reply</Trans>
      </TooltipContent>
    </Tooltip>
  )
}
