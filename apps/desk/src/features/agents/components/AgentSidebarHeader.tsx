import { DeskLogo } from "@/components/shared/DeskLogo"
import { type DeskAgent, flattenDeskAgents } from "../desk-agents"
import { useDeskAgentGroups } from "../hooks/use-desk-agent-groups"
import { AgentSwitcher } from "./AgentSwitcher"

export type AgentSidebarHeaderProps = {
  currentAgent: DeskAgent
}

/** The top of the sidebar: the logo for a person with one agent, the agent switcher otherwise. */
export function AgentSidebarHeader({ currentAgent }: AgentSidebarHeaderProps) {
  const groups = useDeskAgentGroups()
  if (flattenDeskAgents(groups).length <= 1) return <DeskLogo />
  return <AgentSwitcher groups={groups} currentAgent={currentAgent} />
}
