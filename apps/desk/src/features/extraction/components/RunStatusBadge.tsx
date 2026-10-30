import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { RunStateIcon } from "@/components/shared/RunStateIcon"
import { RUN_STATE_LABELS, type RunState } from "@/lib/run-state"

export type RunStatusBadgeProps = {
  state: RunState
}

/** A small badge of where a run stands, with an icon that says it without color. */
export function RunStatusBadge({ state }: RunStatusBadgeProps) {
  const { i18n } = useLingui()
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        state === "failed" ? "border-destructive/30 text-destructive" : "text-foreground",
      )}
    >
      <RunStateIcon state={state} className="size-3.5" />
      {i18n._(RUN_STATE_LABELS[state])}
    </span>
  )
}
