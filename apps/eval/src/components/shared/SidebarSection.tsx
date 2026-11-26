import { Button } from "@caseai-connect/app-ui/components/button"
import { Trans } from "@lingui/react/macro"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { CatchBoundary, type ErrorComponentProps } from "@tanstack/react-router"
import { type ReactNode, Suspense } from "react"
import { SidebarEntriesSkeleton } from "./SidebarEntriesSkeleton"

export type SidebarSectionProps = {
  /** What the section lists, such as a campaign's id: another one starts afresh after a failure. */
  resetKey: string
  children: ReactNode
}

/**
 * A list of the sidebar that reads its own queries and never holds the page back: it waits with
 * its own skeleton, and a failure stays in the sidebar, with a retry.
 */
export function SidebarSection({ resetKey, children }: SidebarSectionProps) {
  return (
    <CatchBoundary getResetKey={() => resetKey} errorComponent={SidebarSectionError}>
      <Suspense fallback={<SidebarEntriesSkeleton />}>{children}</Suspense>
    </CatchBoundary>
  )
}

function SidebarSectionError({ reset }: ErrorComponentProps) {
  const queryErrorResetBoundary = useQueryErrorResetBoundary()
  const handleRetry = () => {
    queryErrorResetBoundary.reset()
    reset()
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        <Trans>This list could not load.</Trans>
      </p>
      <Button variant="outline" size="sm" onClick={handleRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  )
}
