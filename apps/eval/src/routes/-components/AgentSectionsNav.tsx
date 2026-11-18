import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { FlaskConicalIcon, LayoutGridIcon } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import type { EvaluationAgent } from "@/features/agents"
import { CampaignsSidebarMenu } from "@/features/campaigns"
import { AGENT_SECTION_ROUTES, type AgentSection } from "./agent-sections"
import { ParticipantSidebarMenus } from "./ParticipantSidebarMenus"

export type AgentSectionsNavProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  sections: AgentSection[]
}

/**
 * What an agent opens for the person, at the top of the sidebar: the way back to the agent's first
 * page when it holds several sections, its evaluations, the menu of its review campaigns for who
 * manages them, and the menus of the campaigns the person tests or reviews.
 */
export function AgentSectionsNav({ agent, agentParams, sections }: AgentSectionsNavProps) {
  const { t } = useLingui()
  const agentName = agent.name
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
        {sections.includes("evaluations") ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link
                  to={AGENT_SECTION_ROUTES.evaluations}
                  params={agentParams}
                  activeProps={{ "data-active": true }}
                />
              }
            >
              <FlaskConicalIcon aria-hidden />
              <span>
                <Trans>Evaluations</Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {sections.includes("campaigns") ? (
          <CampaignsSidebarMenu agent={agent} agentParams={agentParams} />
        ) : null}
        <ParticipantSidebarMenus agentId={agent.id} />
      </SidebarMenu>
    </nav>
  )
}
