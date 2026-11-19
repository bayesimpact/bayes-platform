import { useOpenAgentCommandCenter } from "../agent-command-center-context"
import type { DeskAgent } from "../desk-agents"
import { useDeskAgentGroups } from "../hooks/use-desk-agent-groups"
import { AgentIdentity } from "./AgentIdentity"
import { AgentSwitcher } from "./AgentSwitcher"

export type AgentSidebarHeaderProps = {
  currentAgent: DeskAgent
}

/**
 * The top of the sidebar: the current agent. With several agents, it opens the command center
 * that switches agent; with one, it simply shows.
 */
export function AgentSidebarHeader({ currentAgent }: AgentSidebarHeaderProps) {
  const groups = useDeskAgentGroups()
  const openCommandCenter = useOpenAgentCommandCenter()
  if (openCommandCenter) {
    return (
      <AgentSwitcher
        currentAgent={currentAgent}
        showProject={groups.length > 1}
        onOpen={openCommandCenter}
      />
    )
  }
  return (
    <div className="flex h-8 items-center gap-2 p-2 text-sm">
      <AgentIdentity agent={currentAgent} showProject={false} />
    </div>
  )
}
