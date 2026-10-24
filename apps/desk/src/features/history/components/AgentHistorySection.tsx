import { Trans } from "@lingui/react/macro"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { CatchBoundary, type ErrorComponentProps } from "@tanstack/react-router"
import { Suspense } from "react"
import { SidebarEntriesSkeleton } from "@/components/shared/SidebarEntriesSkeleton"
import { Button } from "@/components/ui/button"
import type { HistoryAgent } from "../history-entries"
import { AgentHistory } from "./AgentHistory"

export type AgentHistorySectionProps = {
  agent: HistoryAgent
}

/**
 * The history in the sidebar, which never holds the page back: it waits for its queries with its
 * own skeleton, and a failure stays in the sidebar, with a retry.
 */
export function AgentHistorySection({ agent }: AgentHistorySectionProps) {
  return (
    <CatchBoundary getResetKey={() => agent.agentId} errorComponent={HistoryErrorState}>
      <Suspense fallback={<SidebarEntriesSkeleton />}>
        <AgentHistory agent={agent} />
      </Suspense>
    </CatchBoundary>
  )
}

function HistoryErrorState({ reset }: ErrorComponentProps) {
  const queryErrorResetBoundary = useQueryErrorResetBoundary()
  const handleRetry = () => {
    queryErrorResetBoundary.reset()
    reset()
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        <Trans>The history could not load.</Trans>
      </p>
      <Button variant="outline" size="sm" onClick={handleRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  )
}
