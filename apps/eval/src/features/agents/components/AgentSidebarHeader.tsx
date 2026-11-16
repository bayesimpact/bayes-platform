import { type EvaluationAgent, flattenEvaluationAgents } from "../evaluation-agents"
import { useEvaluationWorkspace } from "../hooks/use-evaluation-workspace"
import { AgentIdentity } from "./AgentIdentity"
import { AgentSwitcher } from "./AgentSwitcher"

export type AgentSidebarHeaderProps = {
  currentAgent: EvaluationAgent
}

/**
 * The top of the sidebar: the current agent, which opens the switcher when the person has
 * several, and simply shows when they have one.
 */
export function AgentSidebarHeader({ currentAgent }: AgentSidebarHeaderProps) {
  const { groups } = useEvaluationWorkspace()
  if (flattenEvaluationAgents(groups).length > 1) {
    return <AgentSwitcher groups={groups} currentAgent={currentAgent} />
  }
  return (
    <div className="flex h-8 items-center gap-2 p-2 text-sm">
      <AgentIdentity agent={currentAgent} showProject={false} />
    </div>
  )
}
