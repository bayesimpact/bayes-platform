import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { FlaskConicalIcon, LayoutGridIcon, type LucideIcon, MegaphoneIcon } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { AGENT_SECTION_ROUTES, type AgentSection } from "./agent-sections"

export type AgentSectionsNavProps = {
  agentName: string
  agentParams: AgentParamsDto
  sections: AgentSection[]
}

const SECTION_LINKS = {
  evaluations: { label: msg`Evaluations`, Icon: FlaskConicalIcon },
  campaigns: { label: msg`Review campaigns`, Icon: MegaphoneIcon },
} satisfies Record<AgentSection, { label: MessageDescriptor; Icon: LucideIcon }>

/**
 * The sections of an agent at the top of the sidebar: one link per feature the person holds on
 * it, and the way back to the agent's first page when there are several. The sidebar then shows
 * what the open section lists.
 */
export function AgentSectionsNav({ agentName, agentParams, sections }: AgentSectionsNavProps) {
  const { t, i18n } = useLingui()
  if (sections.length === 0) return null
  return (
    <nav aria-label={t`Sections of ${agentName}`} className="p-2">
      <SidebarMenu>
        {sections.length > 1 ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to="/o/$organizationId/p/$projectId/a/$agentId"
                  params={agentParams}
                  activeOptions={{ exact: true }}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <LayoutGridIcon aria-hidden />
              <span>
                <Trans comment="The sidebar's link to the first page of an agent, which lists its sections">
                  Overview
                </Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {sections.map((section) => {
          const { label, Icon } = SECTION_LINKS[section]
          return (
            <SidebarMenuItem key={section}>
              <SidebarMenuButton
                render={
                  <Link
                    to={AGENT_SECTION_ROUTES[section]}
                    params={agentParams}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <Icon aria-hidden />
                <span>{i18n._(label)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </nav>
  )
}
