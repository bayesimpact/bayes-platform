import { useLingui } from "@lingui/react/macro"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { isRunActive, type RunStatus } from "@/lib/run-status"
import type { WatchedRun } from "@/lib/watched-runs"

/**
 * Tells the person when a run they watch ends, as the app reads it again by itself: a word when
 * it completes, another when it fails, each with the dataset the run asked, as a page may watch
 * the runs of several datasets. A run a person cancelled has its own word already.
 */
export function useRunEndToasts(runs: WatchedRun[]): void {
  const { t } = useLingui()
  /** Where each run stood at the last read. */
  const previous = useRef<Map<string, RunStatus>>(new Map())
  // An effect: a toast is outside React, and it must show once per run that ends, not per render.
  useEffect(() => {
    for (const run of runs) {
      const before = previous.current.get(run.id)
      if (!before || !isRunActive(before)) continue
      const datasetName = run.datasetName
      if (run.status === "completed") {
        toast.success(
          datasetName === null
            ? t`The evaluation run is complete.`
            : t`The evaluation run on ${datasetName} is complete.`,
        )
      }
      if (run.status === "failed") {
        toast.error(
          datasetName === null
            ? t`The evaluation run failed.`
            : t`The evaluation run on ${datasetName} failed.`,
        )
      }
    }
    previous.current = new Map(runs.map((run) => [run.id, run.status]))
  }, [runs, t])
}
