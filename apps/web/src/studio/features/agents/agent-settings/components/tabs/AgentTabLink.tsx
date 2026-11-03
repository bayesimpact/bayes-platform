import { ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Opens another tab of the agent editor, styled like the "Manage" links of the tabs. */
export function AgentTabLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground"
    >
      {children}
      <ArrowRightIcon className="size-3.5" />
    </button>
  )
}
