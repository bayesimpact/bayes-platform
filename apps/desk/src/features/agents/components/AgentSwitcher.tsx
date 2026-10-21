import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { Fragment } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { DeskAgent, DeskProjectAgents } from "../desk-agents"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentSwitcherProps = {
  groups: DeskProjectAgents[]
  currentAgent: DeskAgent
}

/**
 * The menu at the top of the sidebar that switches agent, across projects. With one project, it
 * names no project; the sidebar shows the logo instead when the person has a single agent.
 */
export function AgentSwitcher({ groups, currentAgent }: AgentSwitcherProps) {
  const { t } = useLingui()
  const hasSeveralProjects = groups.length > 1
  const hasSeveralOrganizations =
    new Set(groups.map((group) => group.project.organization.id)).size > 1
  const agentName = currentAgent.name
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t`Switch agent, current agent: ${agentName}`}
                className="aria-expanded:bg-sidebar-accent"
              />
            }
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <AgentTypeIcon type={currentAgent.type} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              {hasSeveralProjects ? (
                <span className="truncate text-xs text-muted-foreground">
                  {currentAgent.project.name}
                </span>
              ) : null}
              <span className="truncate font-medium">{currentAgent.name}</span>
            </span>
            <ChevronsUpDownIcon aria-hidden className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-56">
            {groups.map((group, index) => (
              <Fragment key={group.project.id}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup>
                  {hasSeveralProjects ? (
                    <DropdownMenuLabel>
                      {group.project.name}
                      {hasSeveralOrganizations ? (
                        <span className="font-normal"> · {group.project.organization.name}</span>
                      ) : null}
                    </DropdownMenuLabel>
                  ) : null}
                  {group.agents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      render={
                        <Link
                          to="/o/$organizationId/p/$projectId/a/$agentId"
                          params={{
                            organizationId: agent.project.organization.id,
                            projectId: agent.project.id,
                            agentId: agent.id,
                          }}
                        />
                      }
                    >
                      <AgentTypeIcon type={agent.type} />
                      <span className="truncate">{agent.name}</span>
                      {agent.id === currentAgent.id ? (
                        <CheckIcon aria-hidden className="ml-auto" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
