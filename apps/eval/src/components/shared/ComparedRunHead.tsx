import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { shortIdOf } from "@/lib/short-id"
import { TimeAgo } from "./TimeAgo"

export type ComparedRunHeadProps = {
  agentParams: AgentParamsDto
  datasetId: string
  run: { id: string; createdAt: number }
  /** The revision of the agent's version the run asked. */
  revision: number
}

/**
 * What heads a run's column in a comparison, inside the cell of its table: its short id, which opens the run in a new tab so
 * the comparison stays behind it, the version of the agent it asked, and how long ago it started.
 */
export function ComparedRunHead({ agentParams, datasetId, run, revision }: ComparedRunHeadProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <Link
        to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
        params={{ ...agentParams, datasetId, runId: run.id }}
        target="_blank"
        rel="noreferrer"
        title={run.id}
        className="font-mono text-xs font-medium text-foreground underline-offset-4 hover:underline"
      >
        {shortIdOf(run.id)}
      </Link>
      <span className="text-xs font-normal whitespace-nowrap">
        <Trans comment="Under a run's id in a comparison: its agent's version, and how long ago it started">
          Version {revision} · <TimeAgo moment={run.createdAt} />
        </Trans>
      </span>
    </div>
  )
}
