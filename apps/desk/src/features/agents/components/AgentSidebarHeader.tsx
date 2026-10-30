import { type DeskAgent, flattenDeskAgents } from "../desk-agents"
import { useDeskAgentGroups } from "../hooks/use-desk-agent-groups"
import { AgentIdentity } from "./AgentIdentity"
import { AgentSwitcher } from "./AgentSwitcher"

export type AgentSidebarHeaderProps = {
  currentAgent: DeskAgent
}

/**
 * The top of the sidebar: the current agent, which opens the switcher when the person has
 * several, and simply shows when they have one.
 */
export function AgentSidebarHeader({ currentAgent }: AgentSidebarHeaderProps) {
  const groups = useDeskAgentGroups()
  if (flattenDeskAgents(groups).length > 1) {
    return <AgentSwitcher groups={groups} currentAgent={currentAgent} />
  }
  return (
    <div className="flex h-8 items-center gap-2 p-2 text-sm">
      <AgentIdentity agent={currentAgent} showProject={false} />
    </div>
  )
}
