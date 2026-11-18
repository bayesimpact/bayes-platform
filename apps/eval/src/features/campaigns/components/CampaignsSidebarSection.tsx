import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SquarePenIcon } from "lucide-react"
import { SidebarSection } from "@/components/shared/SidebarSection"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaign-status"
import { projectCampaignsQueryOptions } from "../api/queries"
import { sidebarCampaignsOf } from "../sidebar-campaigns"

export type CampaignsSidebarSectionProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
}

/**
 * What the review campaigns section lists in the sidebar, for who manages them: the way to a new
 * campaign, then each campaign of the agent with where it stands. The link to the section, above,
 * opens the list of them all.
 */
export function CampaignsSidebarSection({ agent, agentParams }: CampaignsSidebarSectionProps) {
  const canCreate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION)
  return (
    <>
      {canCreate ? (
        <div className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/new"
                    params={agentParams}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <SquarePenIcon aria-hidden />
                <span>
                  <Trans>New campaign</Trans>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      ) : null}
      <SidebarSection resetKey={agent.id}>
        <CampaignLinks agent={agent} agentParams={agentParams} />
      </SidebarSection>
    </>
  )
}

function CampaignLinks({ agent, agentParams }: CampaignsSidebarSectionProps) {
  const { i18n } = useLingui()
  const { data: projectCampaigns } = useSuspenseQuery(projectCampaignsQueryOptions(agentParams))
  const campaigns = sidebarCampaignsOf(projectCampaigns, agent.id)
  if (campaigns.length === 0) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Trans comment="The sidebar's list of an agent's review campaigns, under the link Review campaigns">
          Campaigns
        </Trans>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {campaigns.map((campaign) => (
            <SidebarMenuItem key={campaign.id}>
              <SidebarMenuButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId"
                    params={{ ...agentParams, reviewCampaignId: campaign.id }}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="truncate">{campaign.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {i18n._(CAMPAIGN_STATUS_LABELS[campaign.status])}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
