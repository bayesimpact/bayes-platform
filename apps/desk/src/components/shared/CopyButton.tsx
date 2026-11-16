import { useLingui } from "@lingui/react/macro"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCopyText } from "@/hooks/use-copy-text"

export type CopyButtonProps = {
  text: string
  /** What the button copies, as its tooltip names it. */
  label: string
}

/** Copies a text, such as a message or a value, and says so for a moment. */
export function CopyButton({ text, label: copyLabel }: CopyButtonProps) {
  const { t } = useLingui()
  const { isCopied, copy } = useCopyText()

  const label = isCopied
    ? t({ message: "Copied", comment: "The copy button, once it copied its text" })
    : copyLabel
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={() => void copy(text)}
          />
        }
      >
        {isCopied ? (
          <CheckIcon aria-hidden className="size-3.5" />
        ) : (
          <CopyIcon aria-hidden className="size-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
