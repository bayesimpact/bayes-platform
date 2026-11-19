import type { ConversationRunStatusDto } from "@caseai-connect/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RUN_STATUS_LABELS } from "../run-status"

export type RunStatusBadgeProps = {
  status: ConversationRunStatusDto
}

const VARIANTS = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "outline",
} as const satisfies Record<
  ConversationRunStatusDto,
  "default" | "secondary" | "outline" | "destructive"
>

/** Where a run stands: waiting, under way, over, failed or stopped. */
export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const { i18n } = useLingui()
  return (
    <Badge variant={VARIANTS[status]}>
      {status === "running" ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
      {i18n._(RUN_STATUS_LABELS[status])}
    </Badge>
  )
}
