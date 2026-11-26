import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@caseai-connect/app-ui/components/sidebar"
import { useLingui } from "@lingui/react/macro"
import { ChevronsUpDownIcon } from "lucide-react"
import { ShortcutHint } from "@/components/shared/ShortcutHint"
import { AgentIdentity, type AgentIdentityProps } from "./AgentIdentity"

export type AgentSwitcherProps = {
  currentAgent: AgentIdentityProps["agent"]
  /** Whether to name the agent's project, which matters only when there are several. */
  showProject: boolean
  /** Opens the command center. */
  onOpen: () => void
}

/**
 * The button at the top of the sidebar that names the current agent and opens the command
 * center to switch to another one, with the shortcut that does the same.
 */
export function AgentSwitcher({ currentAgent, showProject, onOpen }: AgentSwitcherProps) {
  const { t } = useLingui()
  const agentName = currentAgent.name
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          // Two lines with the project's name above the agent's, one line otherwise.
          size={showProject ? "lg" : "default"}
          aria-label={t`Switch agent, current agent: ${agentName}`}
          aria-haspopup="dialog"
          onClick={onOpen}
        >
          <AgentIdentity agent={currentAgent} showProject={showProject} />
          <ShortcutHint letter="K" />
          <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
