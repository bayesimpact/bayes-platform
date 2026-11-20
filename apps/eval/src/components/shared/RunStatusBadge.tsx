import { useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RUN_STATUS_LABELS, type RunStatus } from "@/lib/run-status"
import { SUCCESS_BADGE_CLASSES } from "@/lib/success-classes"

export type RunStatusBadgeProps = {
  status: RunStatus
}

const VARIANTS = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "outline",
} as const satisfies Record<RunStatus, "default" | "secondary" | "outline" | "destructive">

/** Where a run stands: waiting, under way, over (in green), failed or stopped. */
export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const { i18n } = useLingui()
  return (
    <Badge
      variant={VARIANTS[status]}
      // A run that is over is green, the green of the version in production.
      className={status === "completed" ? SUCCESS_BADGE_CLASSES : undefined}
    >
      {status === "running" ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
      {i18n._(RUN_STATUS_LABELS[status])}
    </Badge>
  )
}
