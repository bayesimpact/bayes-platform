import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { BackLink } from "./BackLink"
import { PageContainer } from "./PageContainer"
import { PageHeader } from "./PageHeader"

export type CompareRunsPageFrameProps = {
  agentParams: AgentParamsDto
  dataset: { id: string; name: string }
  /** How many of the runs asked are runs of this dataset. */
  runCount: number
  /** The figures of the runs, then their records, side by side. */
  children: ReactNode
}

/**
 * The frame of the comparison of runs, for an agent of any type: the way back to the runs of the
 * dataset, how many runs compare, and a word when none of the runs asked is one of the dataset.
 */
export function CompareRunsPageFrame({
  agentParams,
  dataset,
  runCount,
  children,
}: CompareRunsPageFrameProps) {
  const datasetName = dataset.name
  return (
    <PageContainer>
      <PageHeader
        back={
          <BackLink
            to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId"
            params={{ ...agentParams, datasetId: dataset.id }}
            search={{ tab: "runs" }}
          >
            <Trans comment="The link back from a run to the runs of its dataset">Runs</Trans>
          </BackLink>
        }
        title={<Trans>Compare runs</Trans>}
        description={
          <Plural
            value={runCount}
            _0={`No run of ${datasetName} to compare`}
            one={`# run of ${datasetName}`}
            other={`# runs of ${datasetName}, side by side`}
          />
        }
      />
      {runCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Trans>These runs are gone, or are not runs of this dataset.</Trans>
        </p>
      ) : (
        children
      )}
    </PageContainer>
  )
}
