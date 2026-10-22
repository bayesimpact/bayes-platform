import { cn } from "cn"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from "lucide-react"
import { isLiveRunState, type RunState } from "@/lib/run-state"

/** The icon of each state, which says it without color. */
const ICONS = {
  starting: LoaderCircleIcon,
  running: LoaderCircleIcon,
  done: CircleCheckIcon,
  failed: CircleAlertIcon,
  stopped: CircleSlashIcon,
} as const satisfies Record<RunState, LucideIcon>

export type RunStateIconProps = {
  state: RunState
  /** Whether the icon fades beside text, a failure staying red: in a list or a table. */
  isMuted?: boolean
  className?: string
}

/**
 * The icon of where a run stands: it spins while the run goes on, and a failure is red. It is
 * decorative: the text or label beside it names the state.
 */
export function RunStateIcon({ state, isMuted = false, className }: RunStateIconProps) {
  const Icon = ICONS[state]
  return (
    <Icon
      aria-hidden
      className={cn(
        isLiveRunState(state) && "animate-spin motion-reduce:animate-none",
        state === "failed" && "text-destructive",
        isMuted && state !== "failed" && "text-muted-foreground",
        className,
      )}
    />
  )
}
