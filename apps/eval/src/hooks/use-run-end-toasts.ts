import { useLingui } from "@lingui/react/macro"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { isRunActive, type RunStatus } from "@/lib/run-status"

/**
 * Tells the person when a run they watch ends, as the app reads it again by itself: a word when
 * it completes, another when it fails. A run a person cancelled has its own word already.
 */
export function useRunEndToasts(runs: { id: string; status: RunStatus }[]): void {
  const { t } = useLingui()
  /** Where each run stood at the last read. */
  const previous = useRef<Map<string, RunStatus>>(new Map())
  // An effect: a toast is outside React, and it must show once per run that ends, not per render.
  useEffect(() => {
    for (const run of runs) {
      const before = previous.current.get(run.id)
      if (before && isRunActive(before)) {
        if (run.status === "completed") toast.success(t`The evaluation run is complete.`)
        if (run.status === "failed") toast.error(t`The evaluation run failed.`)
      }
    }
    previous.current = new Map(runs.map((run) => [run.id, run.status]))
  }, [runs, t])
}
