import {
  type AgentParamsDto,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  type ReviewCampaignStatusDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ListIcon, MegaphoneIcon, PlusIcon } from "lucide-react"
import { SidebarCollapsibleMenu } from "@/components/shared/SidebarCollapsibleMenu"
import { SidebarSection } from "@/components/shared/SidebarSection"
import { SidebarSubGroupLabel } from "@/components/shared/SidebarSubGroupLabel"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaign-status"
import { projectCampaignsQueryOptions } from "../api/queries"
import { sidebarCampaignsOf } from "../sidebar-campaigns"

export type CampaignsSidebarMenuProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
}

/** The order of the groups: what is under way, then what is prepared, then what is over. */
const STATUS_ORDER = ["active", "draft", "closed"] as const satisfies ReviewCampaignStatusDto[]

/**
 * The menu of an agent's review campaigns in the sidebar, for who manages them: the table of them
 * all, the way to a new campaign, then the campaigns, grouped by where they stand.
 */
export function CampaignsSidebarMenu({ agent, agentParams }: CampaignsSidebarMenuProps) {
  const canCreate = hasProjectPermission(agent.project, PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION)
  return (
    <SidebarCollapsibleMenu
      Icon={MegaphoneIcon}
      label={
        <Trans comment="The sidebar's menu of the review campaigns an agent's managers run">
          Campaigns
        </Trans>
      }
    >
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns"
              params={agentParams}
              activeOptions={{ exact: true }}
              activeProps={{ "data-active": true }}
            />
          }
        >
          <ListIcon aria-hidden />
          <span>
            <Trans comment="The sidebar's link to the table of all an agent's review campaigns">
              List all
            </Trans>
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {canCreate ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/new"
                params={agentParams}
                activeProps={{ "data-active": true }}
              />
            }
          >
            <PlusIcon aria-hidden />
            <span>
              <Trans>New campaign</Trans>
            </span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      <SidebarSection resetKey={agent.id}>
        <CampaignGroups agent={agent} agentParams={agentParams} />
      </SidebarSection>
    </SidebarCollapsibleMenu>
  )
}

function CampaignGroups({ agent, agentParams }: CampaignsSidebarMenuProps) {
  const { i18n } = useLingui()
  const { data: projectCampaigns } = useSuspenseQuery(projectCampaignsQueryOptions(agentParams))
  const campaigns = sidebarCampaignsOf(projectCampaigns, agent.id)
  return STATUS_ORDER.map((status) => {
    const group = campaigns.filter((campaign) => campaign.status === status)
    if (group.length === 0) return null
    return [
      <SidebarSubGroupLabel key={status}>
        {i18n._(CAMPAIGN_STATUS_LABELS[status])}
      </SidebarSubGroupLabel>,
      ...group.map((campaign) => (
        <SidebarMenuSubItem key={campaign.id}>
          <SidebarMenuSubButton
            render={
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/review-campaigns/$reviewCampaignId"
                params={{ ...agentParams, reviewCampaignId: campaign.id }}
                activeProps={{ "data-active": true }}
              />
            }
          >
            <span className="truncate">{campaign.name}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )),
    ]
  })
}
