import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { ClipboardCheckIcon, MessagesSquareIcon } from "lucide-react"
import { SidebarCollapsibleMenu } from "@/components/shared/SidebarCollapsibleMenu"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { campaignPathParams, useEvaluationWorkspace } from "@/features/agents"

export type ParticipantSidebarMenusProps = {
  /** The agent whose campaigns the menus list. */
  agentId: string
}

/**
 * The campaigns of an agent the person takes part in, in two menus of the sidebar: Tester, the
 * campaigns where they try the agent, and Reviewer, those where they read the testers' sessions.
 * A menu with no campaign does not show.
 */
export function ParticipantSidebarMenus({ agentId }: ParticipantSidebarMenusProps) {
  const { myCampaigns } = useEvaluationWorkspace()
  const agentCampaigns = myCampaigns.filter((campaign) => campaign.agentId === agentId)
  const tested = agentCampaigns.filter((campaign) => campaign.roles.includes("tester"))
  const reviewed = agentCampaigns.filter((campaign) => campaign.roles.includes("reviewer"))
  return (
    <>
      {tested.length > 0 ? (
        <SidebarCollapsibleMenu
          Icon={MessagesSquareIcon}
          label={
            <Trans comment="The sidebar's menu of the campaigns where the person tests an agent">
              Tester
            </Trans>
          }
        >
          {tested.map((campaign) => (
            <SidebarMenuSubItem key={campaign.id}>
              <SidebarMenuSubButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
                    params={campaignPathParams(campaign)}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="truncate">{campaign.name}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarCollapsibleMenu>
      ) : null}
      {reviewed.length > 0 ? (
        <SidebarCollapsibleMenu
          Icon={ClipboardCheckIcon}
          label={
            <Trans comment="The sidebar's menu of the campaigns where the person reviews an agent's sessions">
              Reviewer
            </Trans>
          }
        >
          {reviewed.map((campaign) => (
            <SidebarMenuSubItem key={campaign.id}>
              <SidebarMenuSubButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
                    params={campaignPathParams(campaign)}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="truncate">{campaign.name}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarCollapsibleMenu>
      ) : null}
    </>
  )
}
