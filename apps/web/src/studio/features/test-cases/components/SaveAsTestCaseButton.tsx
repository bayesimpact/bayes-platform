import { Button } from "@caseai-connect/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { FlaskConicalIcon } from "lucide-react"

const LABEL = "Save as test case"

/**
 * Opens the Save as test case dialog: an icon in the footer of a playground answer, next to copy and the
 * revision badge, or a labelled button on a feedback item.
 */
export function SaveAsTestCaseButton({
  withLabel = false,
  onClick,
}: {
  withLabel?: boolean
  onClick: () => void
}) {
  if (withLabel) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={onClick}>
        <FlaskConicalIcon className="size-3.5" />
        {LABEL}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={LABEL}
          onClick={onClick}
        >
          <FlaskConicalIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL}</TooltipContent>
    </Tooltip>
  )
}
