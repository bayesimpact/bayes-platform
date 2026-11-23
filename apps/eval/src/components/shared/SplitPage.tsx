import type { ReactNode } from "react"

export type SplitPageProps = {
  /** The side panel docked on the right, or nothing while it is closed. */
  panel: ReactNode
  children: ReactNode
}

/**
 * A page beside a side panel: the page scrolls in its own column, so the panel stays in view
 * while the person reads the page, and each scrolls alone.
 */
export function SplitPage({ panel, children }: SplitPageProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
      {panel}
    </div>
  )
}
