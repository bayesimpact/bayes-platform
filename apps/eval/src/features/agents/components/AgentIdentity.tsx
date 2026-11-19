import type { AgentTypeDto } from "@caseai-connect/eval-contracts"
import { AgentTypeIcon } from "@/components/shared/AgentTypeIcon"

export type AgentIdentityProps = {
  /** The agent, with its project when the person holds it through one. */
  agent: { name: string; type: AgentTypeDto; project?: { name: string } }
  /** Whether to name the agent's project, which matters only when there are several. */
  showProject: boolean
}

/** The current agent at the top of the sidebar: the icon of its type, its name, and its project. */
export function AgentIdentity({ agent, showProject }: AgentIdentityProps) {
  return (
    <>
      <span className="flex shrink-0 [&_svg]:size-4">
        <AgentTypeIcon type={agent.type} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        {showProject && agent.project ? (
          <span className="truncate text-xs text-muted-foreground">{agent.project.name}</span>
        ) : null}
        <span className="truncate font-medium">{agent.name}</span>
      </span>
    </>
  )
}
