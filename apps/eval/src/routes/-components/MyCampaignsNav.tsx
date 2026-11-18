import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { ClipboardCheckIcon, MessageSquareIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { campaignPathParams, useEvaluationWorkspace } from "@/features/agents"

export type MyCampaignsNavProps = {
  /** The campaign whose pages show, which the sidebar already names when it is the only one. */
  currentCampaignId?: string
}

/**
 * The review campaigns the person tests or reviews, on every page: one link per role. A person
 * with one role in one campaign sees no list on that campaign's pages: there is nowhere else to go.
 */
export function MyCampaignsNav({ currentCampaignId }: MyCampaignsNavProps) {
  const { myCampaigns } = useEvaluationWorkspace()
  const entries = myCampaigns.flatMap((campaign) =>
    campaign.roles.map((role) => ({ campaign, role })),
  )
  const isOnItsOnlyCampaign = entries.length === 1 && entries[0]?.campaign.id === currentCampaignId
  if (entries.length === 0 || isOnItsOnlyCampaign) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Trans comment="The sidebar's group of the campaigns a person tests or reviews">
          My campaigns
        </Trans>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {entries.map(({ campaign, role }) => (
            <SidebarMenuItem key={`${campaign.id}-${role}`}>
              <SidebarMenuButton
                render={
                  role === "tester" ? (
                    <Link
                      to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test"
                      params={campaignPathParams(campaign)}
                      activeProps={{ "data-active": true }}
                    />
                  ) : (
                    <Link
                      to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review"
                      params={campaignPathParams(campaign)}
                      activeProps={{ "data-active": true }}
                    />
                  )
                }
              >
                {role === "tester" ? (
                  <MessageSquareIcon aria-hidden />
                ) : (
                  <ClipboardCheckIcon aria-hidden />
                )}
                <span className="truncate">{campaign.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {role === "tester" ? (
                    <Trans
                      context="sidebar"
                      comment="Marks a campaign the person tests, in the sidebar"
                    >
                      Test
                    </Trans>
                  ) : (
                    <Trans
                      context="sidebar"
                      comment="Marks a campaign the person reviews, in the sidebar"
                    >
                      Review
                    </Trans>
                  )}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
