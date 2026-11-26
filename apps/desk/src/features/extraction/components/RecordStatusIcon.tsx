import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/app-ui/components/tooltip"
import type { CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { RunStateIcon } from "@/components/shared/RunStateIcon"
import { RUN_STATE_LABELS } from "@/lib/run-state"
import { CSV_RECORD_STATES } from "../run-states"

export type RecordStatusIconProps = {
  record: CsvExtractionRecordOutputDto
}

/** Where a row of a CSV run stands, as an icon named for screen readers and on hover. */
export function RecordStatusIcon({ record }: RecordStatusIconProps) {
  const { i18n } = useLingui()
  const state = CSV_RECORD_STATES[record.status]
  const label = i18n._(RUN_STATE_LABELS[state])
  return (
    <Tooltip>
      <TooltipTrigger render={<span role="img" aria-label={label} className="inline-flex" />}>
        <RunStateIcon state={state} isMuted className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
