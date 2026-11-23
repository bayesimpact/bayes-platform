import type { ConversationRunRecordStatusDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SUCCESS_BADGE_CLASSES } from "@/lib/success-classes"

export type RunRecordStatusBadgeProps = {
  status: ConversationRunRecordStatusDto
}

const LABELS = {
  graded: msg({
    message: "Graded",
    context: "record status",
    comment: "A record of a run the judge graded",
  }),
  error: msg({ message: "Error", comment: "A record of a run an error stopped" }),
  running: msg({ message: "Waiting", comment: "A record of a run the agent has not answered yet" }),
  cancelled: msg({
    message: "Not asked",
    comment: "A record of a run stopped before the agent answered it",
  }),
} satisfies Record<ConversationRunRecordStatusDto, MessageDescriptor>

const VARIANTS = {
  graded: "secondary",
  error: "destructive",
  running: "outline",
  cancelled: "outline",
} as const satisfies Record<ConversationRunRecordStatusDto, "secondary" | "outline" | "destructive">

/** Where a record of a conversation run stands: graded, in green, in error, waiting or not asked. */
export function RunRecordStatusBadge({ status }: RunRecordStatusBadgeProps) {
  const { i18n } = useLingui()
  return (
    <Badge
      variant={VARIANTS[status]}
      // A graded record is green, the green of a run that is over.
      className={status === "graded" ? SUCCESS_BADGE_CLASSES : undefined}
    >
      {status === "running" ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
      {i18n._(LABELS[status])}
    </Badge>
  )
}
