import type { CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { CircleAlertIcon, CircleCheckIcon, CircleSlashIcon, LoaderCircleIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type RecordStatusIconProps = {
  record: CsvExtractionRecordOutputDto
}

/** Where a row of a CSV run stands, as an icon named for screen readers and on hover. */
export function RecordStatusIcon({ record }: RecordStatusIconProps) {
  const { t } = useLingui()
  const { label, icon } = {
    success: { label: t`Done`, icon: <CircleCheckIcon className="size-4 text-muted-foreground" /> },
    error: { label: t`Failed`, icon: <CircleAlertIcon className="size-4 text-destructive" /> },
    running: {
      label: t`Running`,
      icon: (
        <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
      ),
    },
    cancelled: {
      label: t`Stopped`,
      icon: <CircleSlashIcon className="size-4 text-muted-foreground" />,
    },
  }[record.status]
  return (
    <Tooltip>
      <TooltipTrigger render={<span role="img" aria-label={label} className="inline-flex" />}>
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
