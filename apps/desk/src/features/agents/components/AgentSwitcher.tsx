import { useLingui } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { Fragment } from "react"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { DeskAgent, DeskProjectAgents } from "../desk-agents"
import { agentPathParams } from "../find-agent"
import { AgentIdentity } from "./AgentIdentity"
import { AgentTypeIcon } from "./AgentTypeIcon"

export type AgentSwitcherProps = {
  groups: DeskProjectAgents[]
  currentAgent: DeskAgent
}

/** What a search matches in an agent: its name, its project's and its organization's. */
function matchesSearch(agent: DeskAgent, query: string): boolean {
  const search = query.trim().toLocaleLowerCase()
  if (search === "") return true
  return [agent.name, agent.project.name, agent.project.organization.name].some((text) =>
    text.toLocaleLowerCase().includes(search),
  )
}

/**
 * The menu at the top of the sidebar that switches agent, across projects, with a search on the
 * names of the agents, projects and organizations. With one project, it names no project; the
 * sidebar shows the agent alone when the person has a single one.
 */
export function AgentSwitcher({ groups, currentAgent }: AgentSwitcherProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const hasSeveralProjects = groups.length > 1
  const hasSeveralOrganizations =
    new Set(groups.map((group) => group.project.organization.id)).size > 1
  const agentName = currentAgent.name
  const items = groups.map((group) => ({ value: group.project.id, group, items: group.agents }))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Combobox
          items={items}
          value={currentAgent}
          onValueChange={(agent: DeskAgent | null) => {
            if (agent && agent.id !== currentAgent.id) {
              void navigate({
                to: "/o/$organizationId/p/$projectId/a/$agentId",
                params: agentPathParams(agent),
              })
            }
          }}
          itemToStringLabel={(agent: DeskAgent) => agent.name}
          isItemEqualToValue={(agent: DeskAgent, value: DeskAgent) => agent.id === value.id}
          filter={(agent: DeskAgent, query: string) => matchesSearch(agent, query)}
        >
          <ComboboxTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t`Switch agent, current agent: ${agentName}`}
                className="aria-expanded:bg-sidebar-accent [&>svg:last-child]:ml-auto"
              />
            }
          >
            <AgentIdentity agent={currentAgent} showProject={hasSeveralProjects} />
          </ComboboxTrigger>
          <ComboboxContent align="start" className="w-(--anchor-width) min-w-64">
            <ComboboxInput
              showTrigger={false}
              placeholder={
                hasSeveralProjects ? t`Search an agent or a project` : t`Search an agent`
              }
              aria-label={t`Search an agent`}
            />
            <ComboboxEmpty>{t`No agent matches this search.`}</ComboboxEmpty>
            <ComboboxList>
              {(item: (typeof items)[number], index: number) => (
                <Fragment key={item.value}>
                  {index > 0 ? <ComboboxSeparator /> : null}
                  <ComboboxGroup items={item.items}>
                    {hasSeveralProjects ? (
                      <ComboboxLabel>
                        {item.group.project.name}
                        {hasSeveralOrganizations ? (
                          <span> · {item.group.project.organization.name}</span>
                        ) : null}
                      </ComboboxLabel>
                    ) : null}
                    <ComboboxCollection>
                      {(agent: DeskAgent) => (
                        <ComboboxItem key={agent.id} value={agent}>
                          <AgentTypeIcon type={agent.type} />
                          <span className="truncate">{agent.name}</span>
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxGroup>
                </Fragment>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
