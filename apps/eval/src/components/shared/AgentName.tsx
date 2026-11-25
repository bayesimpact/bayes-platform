import type { AgentTypeDto } from "@bayes-platform/eval-contracts"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentNameProps = {
  name: string
  type: AgentTypeDto
}

/** An agent's name with the icon of its type, as a title shows it. */
export function AgentName({ name, type }: AgentNameProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 [&_svg]:size-4">
        <AgentTypeIcon type={type} />
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}
