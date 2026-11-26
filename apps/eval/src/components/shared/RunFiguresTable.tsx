import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/app-ui/components/table"
import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { ComparedRunHead } from "./ComparedRunHead"

/** A figure of the comparison: its name, and its value for a run. */
export type RunFigure<TRun> = {
  key: string
  label: ReactNode
  render: (run: TRun) => ReactNode
}

export type RunFiguresTableProps<TRun extends { id: string; createdAt: number }> = {
  agentParams: AgentParamsDto
  datasetId: string
  /** The runs compared, in the order the person picked them. */
  runs: TRun[]
  figures: RunFigure<TRun>[]
  /** The revision of the agent's version a run asked, for the head of its column. */
  revisionOf: (run: TRun) => number
}

/**
 * The figures of the runs compared, for an agent of any type: a row per figure, a column per run.
 * The feature gives the figures of its own runs.
 */
export function RunFiguresTable<TRun extends { id: string; createdAt: number }>({
  agentParams,
  datasetId,
  runs,
  figures,
  revisionOf,
}: RunFiguresTableProps<TRun>) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        <Trans comment="The title of the figures of the runs compared">Figures</Trans>
      </h2>
      <div className="overflow-hidden rounded-lg border bg-background dark:bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 text-xs">
                <Trans comment="The header of the column of what the comparison measures">
                  Figure
                </Trans>
              </TableHead>
              {runs.map((run) => (
                <TableHead key={run.id} className="h-auto py-2 align-bottom">
                  <ComparedRunHead
                    agentParams={agentParams}
                    datasetId={datasetId}
                    run={run}
                    revision={revisionOf(run)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {figures.map((figure) => (
              <TableRow key={figure.key}>
                <TableCell className="text-muted-foreground">{figure.label}</TableCell>
                {runs.map((run) => (
                  <TableCell key={run.id} className="tabular-nums">
                    {figure.render(run)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
