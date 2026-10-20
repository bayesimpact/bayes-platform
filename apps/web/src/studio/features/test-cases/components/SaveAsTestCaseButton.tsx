import { Button } from "@caseai-connect/ui/shad/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { FlaskConicalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Opens the Save as test case dialog: an icon in the footer of a playground answer, next to copy
 * and the revision badge, or a labelled button on a feedback item.
 */
export function SaveAsTestCaseButton({
  withLabel = false,
  disabled = false,
  onClick,
}: {
  withLabel?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const label = t("testCase:saveAsTestCase")

  if (withLabel) {
    return (
      <Button variant="outline" size="sm" className="w-fit" disabled={disabled} onClick={onClick}>
        <FlaskConicalIcon className="size-3.5" />
        {label}
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
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          <FlaskConicalIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
