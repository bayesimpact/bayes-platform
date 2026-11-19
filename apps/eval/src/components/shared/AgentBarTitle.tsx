import type { AgentTypeDto } from "@caseai-connect/eval-contracts"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentBarTitleProps = {
  name: string
  type: AgentTypeDto
}

/** The agent in the bar above the page, while the sidebar that names it is closed. */
export function AgentBarTitle({ name, type }: AgentBarTitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 [&_svg]:size-4">
        <AgentTypeIcon type={type} />
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}
