import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import { CircleAlertIcon, CircleCheckIcon, CircleSlashIcon, LoaderCircleIcon } from "lucide-react"

/** Where a run stands, as both kinds of run share it. */
export type RunState = "starting" | "running" | "done" | "failed" | "stopped"

export type RunStatusBadgeProps = {
  state: RunState
}

/** A small badge of where a run stands, with an icon that says it without color. */
export function RunStatusBadge({ state }: RunStatusBadgeProps) {
  const isLive = state === "starting" || state === "running"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        state === "failed" && "border-destructive/30 text-destructive",
        state !== "failed" && "text-foreground",
      )}
    >
      {isLive ? (
        <LoaderCircleIcon
          aria-hidden
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {state === "done" ? <CircleCheckIcon aria-hidden className="size-3.5" /> : null}
      {state === "failed" ? <CircleAlertIcon aria-hidden className="size-3.5" /> : null}
      {state === "stopped" ? <CircleSlashIcon aria-hidden className="size-3.5" /> : null}
      {
        {
          starting: <Trans comment="A run waiting for its turn">Starting</Trans>,
          running: <Trans comment="A run in progress">Running</Trans>,
          done: <Trans comment="A run that ended well">Done</Trans>,
          failed: <Trans comment="A run that ended with an error">Failed</Trans>,
          stopped: <Trans comment="A run the person stopped">Stopped</Trans>,
        }[state]
      }
    </span>
  )
}
