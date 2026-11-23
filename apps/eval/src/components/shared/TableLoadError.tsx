import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export type TableLoadErrorProps = {
  /** What could not load. */
  children: ReactNode
  /** Reads the rows again. */
  onRetry: () => void
}

/** What a table shows in place of its rows when they could not load: what failed, and a retry. */
export function TableLoadError({ children, onRetry }: TableLoadErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p>{children}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  )
}
