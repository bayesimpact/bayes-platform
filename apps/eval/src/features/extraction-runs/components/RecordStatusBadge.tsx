import type { ExtractionRunRecordStatusDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export type RecordStatusBadgeProps = {
  status: ExtractionRunRecordStatusDto
}

const LABELS = {
  match: msg({
    message: "Match",
    comment: "A record of a run where every compared field has the value expected",
  }),
  mismatch: msg({
    message: "Mismatch",
    comment: "A record of a run where a compared field differs from the value expected",
  }),
  error: msg({ message: "Error", comment: "A record of a run an error stopped" }),
  running: msg({ message: "Waiting", comment: "A record of a run the agent has not answered yet" }),
  cancelled: msg({
    message: "Not asked",
    comment: "A record of a run stopped before the agent answered it",
  }),
} satisfies Record<ExtractionRunRecordStatusDto, MessageDescriptor>

const VARIANTS = {
  match: "secondary",
  mismatch: "destructive",
  error: "destructive",
  running: "outline",
  cancelled: "outline",
} as const satisfies Record<ExtractionRunRecordStatusDto, "secondary" | "outline" | "destructive">

/** Where a record of an extraction run stands: a match, in green, a mismatch, an error, or no answer. */
export function RecordStatusBadge({ status }: RecordStatusBadgeProps) {
  const { i18n } = useLingui()
  return (
    <Badge
      variant={VARIANTS[status]}
      // A match is green, the green of a run that is over.
      className={
        status === "match"
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : undefined
      }
    >
      {status === "running" ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
      {i18n._(LABELS[status])}
    </Badge>
  )
}
