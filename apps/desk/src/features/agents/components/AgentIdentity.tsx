import type { DeskAgent } from "../desk-agents"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentIdentityProps = {
  agent: DeskAgent
  /** Whether to name the agent's project, which matters only when there are several. */
  showProject: boolean
}

/** The current agent at the top of the sidebar: its type's icon, its name, and its project. */
export function AgentIdentity({ agent, showProject }: AgentIdentityProps) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <AgentTypeIcon type={agent.type} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        {showProject ? (
          <span className="truncate text-xs text-muted-foreground">{agent.project.name}</span>
        ) : null}
        <span className="truncate font-medium">{agent.name}</span>
      </span>
    </>
  )
}
