import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { GitCompareArrowsIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"

export type CompareRunsButtonProps = {
  agentParams: AgentParamsDto
  datasetId: string
  /** The runs picked for the comparison, in the order they were picked. */
  comparedIds: string[]
}

/**
 * The way to the comparison of the runs picked in the list of a dataset's runs: a link once two
 * runs or more are picked, a button that waits until then.
 */
export function CompareRunsButton({ agentParams, datasetId, comparedIds }: CompareRunsButtonProps) {
  const comparedCount = comparedIds.length
  const label = (
    <>
      <GitCompareArrowsIcon data-icon="inline-start" aria-hidden />
      {comparedCount === 0 ? (
        <Trans comment="Opens the comparison of the runs picked in the list">Compare runs</Trans>
      ) : (
        <Plural value={comparedCount} one="Compare # run" other="Compare # runs" />
      )}
    </>
  )
  if (comparedCount < 2) {
    return (
      <Button variant="outline" disabled>
        {label}
      </Button>
    )
  }
  return (
    <Link
      to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/compare"
      params={{ ...agentParams, datasetId }}
      search={{ runs: comparedIds.join(",") }}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      {label}
    </Link>
  )
}
