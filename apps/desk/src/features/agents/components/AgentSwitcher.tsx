import { useLingui } from "@lingui/react/macro"
import { ChevronsUpDownIcon } from "lucide-react"
import { ShortcutHint } from "@/components/shared/ShortcutHint"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useOpenAgentCommandCenter } from "../agent-command-center-context"
import type { DeskAgent } from "../desk-agents"
import { AgentIdentity } from "./AgentIdentity"

export type AgentSwitcherProps = {
  currentAgent: DeskAgent
  /** Whether to name the agent's project, which matters only when there are several. */
  showProject: boolean
}

/**
 * The button at the top of the sidebar that names the current agent and opens the command
 * center to switch to another one, with the shortcut that does the same.
 */
export function AgentSwitcher({ currentAgent, showProject }: AgentSwitcherProps) {
  const { t } = useLingui()
  const openCommandCenter = useOpenAgentCommandCenter()
  const agentName = currentAgent.name
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          // Two lines with the project's name above the agent's, one line otherwise.
          size={showProject ? "lg" : "default"}
          aria-label={t`Switch agent, current agent: ${agentName}`}
          aria-haspopup="dialog"
          onClick={() => openCommandCenter?.()}
        >
          <AgentIdentity agent={currentAgent} showProject={showProject} />
          <ShortcutHint letter="K" />
          <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
