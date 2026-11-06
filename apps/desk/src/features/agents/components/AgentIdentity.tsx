import type { DeskAgent } from "../desk-agents"

export type AgentIdentityProps = {
  agent: DeskAgent
  /** Whether to name the agent's project, which matters only when there are several. */
  showProject: boolean
}

/** The current agent at the top of the sidebar: its name, and its project. */
export function AgentIdentity({ agent, showProject }: AgentIdentityProps) {
  return (
    <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
      {showProject ? (
        <span className="truncate text-xs text-muted-foreground">{agent.project.name}</span>
      ) : null}
      <span className="truncate font-medium">{agent.name}</span>
    </span>
  )
}
