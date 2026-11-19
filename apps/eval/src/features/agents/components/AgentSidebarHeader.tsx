import { switchableAgentCountOf } from "../campaign-agents"
import type { EvaluationAgent } from "../evaluation-agents"
import { useEvaluationWorkspace } from "../hooks/use-evaluation-workspace"
import { AgentIdentity } from "./AgentIdentity"
import { AgentSwitcher } from "./AgentSwitcher"

export type AgentSidebarHeaderProps = {
  currentAgent: EvaluationAgent
}

/**
 * The top of the sidebar: the current agent. With several agents, it opens the command center
 * that switches agent; with one, it simply shows.
 */
export function AgentSidebarHeader({ currentAgent }: AgentSidebarHeaderProps) {
  const workspace = useEvaluationWorkspace()
  const { groups } = workspace
  if (switchableAgentCountOf(workspace) > 1) {
    return <AgentSwitcher currentAgent={currentAgent} showProject={groups.length > 1} />
  }
  return (
    <div className="flex h-8 items-center gap-2 p-2 text-sm">
      <AgentIdentity agent={currentAgent} showProject={false} />
    </div>
  )
}
