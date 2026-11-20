import { Plural, Trans, useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RUN_STATUS_LABELS, RUN_STATUS_ORDER, type RunSummary } from "@/lib/run-status"

export type RunsByStatusProps<TRun extends RunSummary> = {
  /** The agent's runs of a dataset, the newest first. */
  runs: TRun[]
  /** What sits beside the title, such as the way to compare runs. */
  actions?: ReactNode
  /** The table of the runs that stand at one status. */
  renderTable: (runs: TRun[]) => ReactNode
}

/**
 * The runs of an agent on a dataset, in one sub-tab per status, the newest first in each: the
 * feature gives the table of its own runs.
 */
export function RunsByStatus<TRun extends RunSummary>({
  runs,
  actions,
  renderTable,
}: RunsByStatusProps<TRun>) {
  const { i18n } = useLingui()
  const runCount = runs.length
  // The statuses that hold runs, in the order of the sub-tabs.
  const statuses = RUN_STATUS_ORDER.filter((status) => runs.some((run) => run.status === status))
  const [firstStatus] = statuses
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the runs of a dataset">Runs</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Plural value={runCount} _0="No run yet" one="# run" other="# runs" />
          </p>
        </div>
        {actions}
      </div>
      {runCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Trans>No evaluation ran on this dataset yet.</Trans>
        </p>
      ) : null}
      {firstStatus ? (
        // Its statuses as keys: a status that gains its first run, or loses its last one, starts
        // the sub-tabs afresh on one that holds runs.
        <Tabs key={statuses.join()} defaultValue={firstStatus}>
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            {statuses.map((status) => {
              const statusName = i18n._(RUN_STATUS_LABELS[status])
              const count = i18n.number(runs.filter((run) => run.status === status).length)
              return (
                <TabsTrigger key={status} value={status}>
                  <Trans comment="A sub-tab of a dataset's runs: a status and how many runs stand at it">
                    {statusName} ({count})
                  </Trans>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {statuses.map((status) => (
            <TabsContent key={status} value={status}>
              {renderTable(runs.filter((run) => run.status === status))}
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </>
  )
}
